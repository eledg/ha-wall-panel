// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const lib = vi.hoisted(() => ({
  getAuth: vi.fn(),
  createLongLivedTokenAuth: vi.fn((url: string, token: string) => ({
    url,
    token,
  })),
}));
vi.mock('home-assistant-js-websocket', () => lib);

import { dropTokens, resolveAuth, TOKENS_KEY, usesDevAuth } from './auth.ts';

beforeEach(() => {
  lib.getAuth.mockReset();
  history.replaceState(null, '', '/local/wall-dashboard/index.html');
  localStorage.clear();
});
afterEach(() => localStorage.clear());

describe('resolveAuth', () => {
  it('uses the dev token and URL', async () => {
    const auth = await resolveAuth({
      url: 'http://ha:8123',
      token: 'dev',
    });

    expect(auth).toEqual({ url: 'http://ha:8123', token: 'dev' });
    expect(lib.getAuth).not.toHaveBeenCalled();
  });

  it('defaults the dev URL to the page origin', async () => {
    await resolveAuth({ token: 'dev' });

    expect(lib.createLongLivedTokenAuth).toHaveBeenCalledWith(
      location.origin,
      'dev',
    );
  });

  it('explains missing dev settings', async () => {
    await expect(resolveAuth({})).rejects.toThrow('HA_DEV_TOKEN');
  });

  it('signs in through HA when there are no dev settings', async () => {
    lib.getAuth.mockResolvedValue('auth');

    await resolveAuth();

    expect(lib.createLongLivedTokenAuth).not.toHaveBeenCalled();
    expect(lib.getAuth).toHaveBeenCalledOnce();
  });

  it('signs in against the page origin and persists tokens', async () => {
    lib.getAuth.mockImplementation(async (options) => {
      options.saveTokens({ access_token: 'a' });
      return 'auth';
    });

    await expect(resolveAuth()).resolves.toBe('auth');

    const options = lib.getAuth.mock.calls[0]![0];
    expect(options.hassUrl).toBe(location.origin);
    expect(JSON.parse(localStorage.getItem(TOKENS_KEY)!)).toEqual({
      access_token: 'a',
    });
    await expect(options.loadTokens()).resolves.toEqual({ access_token: 'a' });
  });

  it('loads nothing when storage holds garbage', async () => {
    lib.getAuth.mockResolvedValue('auth');
    localStorage.setItem(TOKENS_KEY, '{nope');
    await resolveAuth();

    await expect(
      lib.getAuth.mock.calls[0]![0].loadTokens(),
    ).resolves.toBeNull();
  });

  it('strips the redirect parameters after sign-in', async () => {
    history.replaceState(
      null,
      '',
      '/local/wall-dashboard/index.html?auth_callback=1&code=c&state=s&storeToken=true&keep=1',
    );
    lib.getAuth.mockResolvedValue('auth');

    await resolveAuth();

    expect(location.search).toBe('?keep=1');
  });

  it('signs in again when a replayed callback code is spent', async () => {
    history.replaceState(
      null,
      '',
      '/local/x/index.html?auth_callback=1&code=old',
    );
    lib.getAuth.mockRejectedValueOnce(2).mockResolvedValueOnce('auth');

    await expect(resolveAuth()).resolves.toBe('auth');

    expect(lib.getAuth).toHaveBeenCalledTimes(2);
    expect(location.search).toBe('');
  });

  it('rethrows other sign-in failures', async () => {
    lib.getAuth.mockRejectedValue(1);

    await expect(resolveAuth()).rejects.toBe(1);
  });
});

describe('usesDevAuth', () => {
  it('is true only when dev settings exist', () => {
    expect(usesDevAuth({})).toBe(true);
    expect(usesDevAuth(undefined)).toBe(false);
  });
});

describe('dropTokens', () => {
  it('removes saved tokens', () => {
    localStorage.setItem(TOKENS_KEY, '{}');

    dropTokens();

    expect(localStorage.getItem(TOKENS_KEY)).toBeNull();
  });
});

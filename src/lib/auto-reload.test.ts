// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BLOCKS_RELOAD_ATTR,
  buildKey,
  createAutoReload,
  IDLE_MS,
  MIN_RELOAD_GAP_MS,
  SAME_TARGET_GAP_MS,
  STORAGE_KEY,
} from './auto-reload.ts';
import recoverSource from './recover.js?raw';

const running = { version: 'v1.0.0', commit: 'aaa' };
const published = { version: 'v1.1.0', commit: 'bbb' };

const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
};

const jsonResponse = (body: unknown, ok = true) =>
  Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);

const setup = (
  respond: () => Promise<Response> = () => jsonResponse(published),
) => {
  let time = 1_000_000;
  const reload = vi.fn();
  const fetchImpl = vi.fn(respond) as unknown as typeof fetch;
  const storage = memoryStorage();
  const blocked = { value: false };
  const auto = createAutoReload({
    runningKey: buildKey(running),
    versionUrl: 'http://ha/local/wall/version.json',
    indexUrl: 'http://ha/local/wall/index.html',
    fetchImpl,
    now: () => time,
    storage,
    isBlocked: () => blocked.value,
    reload,
  });
  return {
    ...auto,
    reload,
    fetchImpl,
    storage,
    blocked,
    advance: (ms: number) => {
      time += ms;
    },
  };
};

describe('auto reload', () => {
  it('reloads to index.html?v=<id> when the published build differs', async () => {
    const t = setup();
    t.advance(IDLE_MS);

    await t.check();

    expect(t.reload).toHaveBeenCalledWith(
      'http://ha/local/wall/index.html?v=v1.1.0%40bbb',
    );
  });

  it('fetches with a unique query string and no-store', async () => {
    const t = setup();
    await t.check();

    expect(t.fetchImpl).toHaveBeenCalledWith(
      expect.stringMatching(/version\.json\?t=\d+$/),
      { cache: 'no-store' },
    );
  });

  it('reloads for an older build too, so rollbacks apply', async () => {
    const t = setup(() => jsonResponse({ version: 'v0.9.0', commit: 'zzz' }));
    t.advance(IDLE_MS);

    await t.check();

    expect(t.reload).toHaveBeenCalledOnce();
  });

  it('does nothing when the build is unchanged', async () => {
    const t = setup(() => jsonResponse(running));
    t.advance(IDLE_MS);

    await t.check();

    expect(t.reload).not.toHaveBeenCalled();
  });

  it('waits until there has been no touch for the idle time', async () => {
    const t = setup();
    t.advance(IDLE_MS);
    t.touch();
    t.advance(IDLE_MS - 1);

    await t.check();
    expect(t.reload).not.toHaveBeenCalled();

    t.advance(1);
    await t.check();
    expect(t.reload).toHaveBeenCalledOnce();
  });

  it('reports waiting when a new build is blocked on idleness', async () => {
    const t = setup();

    await expect(t.check()).resolves.toBe('waiting');
  });

  it('does not interrupt an open overlay', async () => {
    const t = setup();
    t.advance(IDLE_MS);
    t.blocked.value = true;

    await t.check();
    expect(t.reload).not.toHaveBeenCalled();

    t.blocked.value = false;
    await t.check();
    expect(t.reload).toHaveBeenCalledOnce();
  });

  it.each([
    ['fetch rejects', () => Promise.reject(new Error('offline'))],
    ['non-200', () => jsonResponse({}, false)],
    ['invalid body', () => jsonResponse('nope')],
    ['missing fields', () => jsonResponse({ version: 'v2' })],
  ])('carries on quietly when %s', async (_name, respond) => {
    const t = setup(respond);
    t.advance(IDLE_MS);

    await expect(t.check()).resolves.toBeUndefined();

    expect(t.reload).not.toHaveBeenCalled();
  });

  it('does not loop when the page keeps coming back as the old build', async () => {
    const t = setup();
    t.advance(IDLE_MS);

    await t.check();
    t.advance(MIN_RELOAD_GAP_MS + 1);
    await t.check();
    t.advance(SAME_TARGET_GAP_MS - MIN_RELOAD_GAP_MS - 10);
    await t.check();

    expect(t.reload).toHaveBeenCalledOnce();

    t.advance(20);
    await t.check();
    expect(t.reload).toHaveBeenCalledTimes(2);
  });

  it('limits reloads to different targets to one per gap', async () => {
    let body = published;
    const t = setup(() => jsonResponse(body));
    t.advance(IDLE_MS);
    await t.check();

    body = { version: 'v1.2.0', commit: 'ccc' };
    t.advance(MIN_RELOAD_GAP_MS - 1);
    await t.check();
    expect(t.reload).toHaveBeenCalledOnce();

    t.advance(1);
    await t.check();
    expect(t.reload).toHaveBeenCalledTimes(2);
  });

  it('refuses to reload when storage is unavailable', async () => {
    const t = setup();
    t.storage.setItem = () => {
      throw new Error('denied');
    };
    t.advance(IDLE_MS);

    await t.check();

    expect(t.reload).not.toHaveBeenCalled();
  });
});

describe('manual update', () => {
  it('reloads straight away to a different build, ignoring idle, overlays and the rate limit', async () => {
    const t = setup();
    t.blocked.value = true;
    t.storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ at: 1_000_000, to: buildKey(published) }),
    );

    const result = await t.checkNow();

    expect(result).toEqual({ status: 'reloading' });
    expect(t.reload).toHaveBeenCalledWith(
      'http://ha/local/wall/index.html?v=v1.1.0%40bbb',
    );
  });

  it('reloads for an older build too, so rollbacks apply', async () => {
    const t = setup(() => jsonResponse({ version: 'v0.9.0', commit: 'ccc' }));

    await t.checkNow();

    expect(t.reload).toHaveBeenCalledOnce();
  });

  it('reports up to date, with the time, and does not reload', async () => {
    const t = setup(() => jsonResponse(running));
    t.advance(5_000);

    const result = await t.checkNow();

    expect(result).toEqual({ status: 'current', at: 1_005_000 });
    expect(t.reload).not.toHaveBeenCalled();
  });

  it('fetches with a unique query string and no-store', async () => {
    const t = setup(() => jsonResponse(running));

    await t.checkNow();
    t.advance(1);
    await t.checkNow();

    const calls = vi.mocked(t.fetchImpl).mock.calls;
    expect(calls.map(([url]) => url)).toEqual([
      'http://ha/local/wall/version.json?t=1000000',
      'http://ha/local/wall/version.json?t=1000001',
    ]);
    expect(calls[0]![1]).toEqual({ cache: 'no-store' });
  });

  it.each([
    ['is unreachable', () => Promise.reject(new Error('offline'))],
    ['returns an error status', () => jsonResponse(published, false)],
    ['is malformed', () => jsonResponse({ nope: true })],
  ])(
    'reports a failed check and leaves the page alone when version.json %s',
    async (_name, respond) => {
      const t = setup(respond);

      expect(await t.checkNow()).toEqual({ status: 'failed' });
      expect(t.reload).not.toHaveBeenCalled();
    },
  );
});

// The inline copy (recover.js) must behave the same, so run it for real.
describe('inline recovery script (recover.js)', () => {
  const source = recoverSource.replace(
    /(?<!global )__BUILD_INFO__/,
    JSON.stringify({ ...running, builtAt: 'x' }),
  );

  const flush = async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  };

  const run = (respond: () => Promise<Response>) => {
    const storage = memoryStorage();
    const replace = vi.fn();
    const fetchFake = vi.fn(respond);
    const win = {
      location: { href: 'http://ha/local/wall/index.html' },
      addEventListener: vi.fn(),
    };
    win.location = Object.assign(win.location, { replace });
    new Function('window', 'document', 'fetch', 'localStorage', source)(
      win,
      document,
      fetchFake,
      storage,
    );
    return { replace, storage, fetchFake };
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    document.body.innerHTML = '';
  });

  it('reloads to the published build once idle, with no bundle involved', async () => {
    const t = run(() => jsonResponse(published));
    await flush();
    expect(t.replace).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300_000);

    expect(t.replace).toHaveBeenCalledWith(
      'http://ha/local/wall/index.html?v=v1.1.0%40bbb',
    );
    expect(t.storage.getItem(STORAGE_KEY)).toContain('v1.1.0@bbb');
  });

  it('leaves an open overlay alone', async () => {
    document.body.innerHTML = `<div ${BLOCKS_RELOAD_ATTR}></div>`;
    const t = run(() => jsonResponse(published));

    await vi.advanceTimersByTimeAsync(120_000);

    expect(t.replace).not.toHaveBeenCalled();
  });

  it('survives an unreachable version.json without reloading', async () => {
    const t = run(() => Promise.reject(new Error('offline')));

    await vi.advanceTimersByTimeAsync(300_000);

    expect(t.fetchFake).toHaveBeenCalledTimes(2);
    expect(t.replace).not.toHaveBeenCalled();
  });

  it('does not loop on a build that keeps differing', async () => {
    const t = run(() => jsonResponse(published));

    await vi.advanceTimersByTimeAsync(10 * 60_000);

    expect(t.replace).toHaveBeenCalledOnce();
  });
});

// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./auth.ts', () => ({
  usesDevAuth: vi.fn(() => false),
  dropTokens: vi.fn(),
  hasCallbackParams: vi.fn(() => false),
  resolveAuth: vi.fn(),
}));

import * as auth from './auth.ts';
import { connectHa } from './connect.ts';
import type { HaStore } from './store.ts';

const storeWith = (snapshot: object) =>
  ({
    start: vi.fn().mockResolvedValue(undefined),
    getSnapshot: () => snapshot,
  }) as unknown as HaStore & { start: ReturnType<typeof vi.fn> };

beforeEach(() => vi.clearAllMocks());

describe('connectHa', () => {
  it('starts the store with the resolved auth', async () => {
    const store = storeWith({ status: 'connected' });
    const reload = vi.fn();

    await connectHa(store, undefined, reload);
    await store.start.mock.calls[0]![0]();

    expect(auth.resolveAuth).toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('drops stale saved tokens and reloads once', async () => {
    const reload = vi.fn();

    await connectHa(
      storeWith({ status: 'error', rejected: true }),
      undefined,
      reload,
    );

    expect(auth.dropTokens).toHaveBeenCalled();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('does not loop when freshly issued credentials are rejected', async () => {
    vi.mocked(auth.hasCallbackParams).mockReturnValue(true);
    const reload = vi.fn();

    await connectHa(
      storeWith({ status: 'error', rejected: true }),
      undefined,
      reload,
    );

    expect(auth.dropTokens).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not reload for a rejected dev token', async () => {
    vi.mocked(auth.usesDevAuth).mockReturnValue(true);
    const reload = vi.fn();

    await connectHa(
      storeWith({ status: 'error', rejected: true }),
      undefined,
      reload,
    );

    expect(reload).not.toHaveBeenCalled();
  });
});

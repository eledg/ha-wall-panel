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
    subscribe: () => () => {},
  }) as unknown as HaStore & { start: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth.hasCallbackParams).mockReturnValue(false);
  vi.mocked(auth.usesDevAuth).mockReturnValue(false);
});

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

  it('reloads once when a later reconnect is refused', async () => {
    let snapshot: object = { status: 'connected' };
    let notify = () => {};
    const store = {
      start: vi.fn().mockResolvedValue(undefined),
      getSnapshot: () => snapshot,
      subscribe: (listener: () => void) => {
        notify = listener;
        return () => {};
      },
    } as unknown as HaStore;
    const reload = vi.fn();
    await connectHa(store, undefined, reload);
    expect(reload).not.toHaveBeenCalled();

    snapshot = { status: 'error', rejected: true };
    notify();
    notify();

    expect(auth.dropTokens).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cancellableDelay } from './delay.ts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('cancellableDelay', () => {
  it('resolves after the delay', async () => {
    const settled = vi.fn();
    void cancellableDelay(1000).done.then(settled);

    await vi.advanceTimersByTimeAsync(999);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toHaveBeenCalled();
  });

  it('resolves early on cancel and leaves no timer behind', async () => {
    const { done, cancel } = cancellableDelay(1000);

    cancel();
    await done;

    expect(vi.getTimerCount()).toBe(0);
  });
});

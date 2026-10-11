// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  sampleFrames,
  startPerf,
  tapLatency,
  updatesInWindow,
  WINDOW_MS,
} from './counters.ts';
import type { HaStore } from '../ha/store.ts';

describe('perf', () => {
  afterEach(() => vi.restoreAllMocks());

  it('counts store notifications inside the window only', () => {
    let notify = () => {};
    const store = {
      subscribe: (listener: () => void) => {
        notify = listener;
        return () => {};
      },
    } as unknown as HaStore;
    const stop = startPerf(store);
    const now = performance.now();

    notify();
    notify();
    expect(updatesInWindow(now + 1)).toBe(2);
    expect(updatesInWindow(now + WINDOW_MS + 10)).toBe(0);
    stop();
  });

  it('times a tap to the next frame', () => {
    let frame: FrameRequestCallback = () => {};
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frame = cb;
      return 1;
    });
    const stop = startPerf({ subscribe: () => () => {} } as unknown as HaStore);

    document.dispatchEvent(new Event('pointerdown'));
    frame(0);

    const { last, slowest } = tapLatency();
    expect(last).toBeGreaterThanOrEqual(0);
    expect(slowest).toBeGreaterThanOrEqual(last ?? 0);
    stop();
    vi.unstubAllGlobals();
  });

  it('rates the slowest tap in the window only', () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      callbacks.push(cb),
    );
    const stop = startPerf({ subscribe: () => () => {} } as unknown as HaStore);
    const now = performance.now();

    document.dispatchEvent(new Event('pointerdown'));
    callbacks[0]!(0);

    expect(tapLatency(now + 1).slowest).toBeGreaterThanOrEqual(0);
    expect(tapLatency(now + WINDOW_MS + 1000).slowest).toBeUndefined();
    stop();
    vi.unstubAllGlobals();
  });

  it('reports fps and the worst frame, and stops cleanly', () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      callbacks.push(cb),
    );
    const cancel = vi.fn();
    vi.stubGlobal('cancelAnimationFrame', cancel);
    const onSample = vi.fn();
    const start = performance.now();

    const stop = sampleFrames(onSample);
    // Four frames, the last crossing one second.
    [250, 500, 750, 1010].forEach((t, i) => callbacks[i]!(start + t));

    expect(onSample).toHaveBeenCalledTimes(1);
    const { fps, worstMs } = onSample.mock.calls[0]![0];
    expect(fps).toBeCloseTo(3, 0);
    expect(worstMs).toBeCloseTo(260, 0);
    stop();
    expect(cancel).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

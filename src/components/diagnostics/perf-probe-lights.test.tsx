// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as perf from '@/services/perf/counters.ts';

import { PerfProbe } from './perf-probe.tsx';

vi.mock('@/services/perf/counters.ts');

const setup = (values: {
  render?: number;
  paint?: number;
  updates: number;
  frame?: { fps: number; worstMs: number };
  slowestTap?: number;
}) => {
  vi.mocked(perf.firstRenderMs).mockReturnValue(values.render);
  vi.mocked(perf.firstPaintMs).mockReturnValue(values.paint);
  vi.mocked(perf.heapMb).mockReturnValue(undefined);
  vi.mocked(perf.updatesInWindow).mockReturnValue(values.updates);
  vi.mocked(perf.tapLatency).mockReturnValue({
    last: values.slowestTap,
    slowest: values.slowestTap,
    count: values.slowestTap === undefined ? 0 : 1,
  });
  vi.mocked(perf.sampleFrames).mockImplementation((onSample) => {
    if (values.frame) onSample(values.frame);
    return () => {};
  });
};

describe('PerfProbe lights', () => {
  afterEach(() => render(null, document.body));

  it('shows OK everywhere and overall when the budget is met', async () => {
    setup({
      render: 1500,
      paint: 1200,
      updates: 3,
      frame: { fps: 60, worstMs: 20 },
      slowestTap: 40,
    });
    await act(() => render(<PerfProbe />, document.body));

    const labels = [...document.querySelectorAll('[role=img]')].map((el) =>
      el.getAttribute('aria-label'),
    );
    expect(labels).toEqual(['OK', 'OK', 'OK', 'OK', 'OK', 'OK']);
  });

  it('rates each row and makes the overall light the worst of them', async () => {
    setup({
      render: 2500, // 1.25x: Slow
      paint: 4000, // 2x: Over
      updates: 50, // 2.5x: Over
      frame: { fps: 25, worstMs: 90 }, // fps 25: Slow
      slowestTap: 80, // OK
    });
    await act(() => render(<PerfProbe />, document.body));

    const labels = [...document.querySelectorAll('[role=img]')].map((el) =>
      el.getAttribute('aria-label'),
    );
    // Overall first, then render, paint, updates, frames, taps.
    expect(labels).toEqual(['Over', 'Slow', 'Over', 'Over', 'Slow', 'OK']);
  });

  it('shows n/a for what is not measured yet', async () => {
    setup({ updates: 0 });
    await act(() => render(<PerfProbe />, document.body));

    const labels = [...document.querySelectorAll('[role=img]')].map((el) =>
      el.getAttribute('aria-label'),
    );
    // Overall is OK from the updates row alone; the rest are n/a.
    expect(labels).toEqual(['OK', 'n/a', 'n/a', 'OK', 'n/a', 'n/a']);
  });
});

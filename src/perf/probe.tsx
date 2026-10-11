import { useEffect, useState } from 'preact/hooks';

import {
  firstPaintMs,
  firstRenderMs,
  heapMb,
  sampleFrames,
  tapLatency,
  updatesInWindow,
} from './counters.ts';
import { PERF_BUDGET, rateMax, rateMin, worst } from './status.ts';
import type { Light } from './status.ts';

const ms = (value: number | undefined) =>
  value === undefined ? 'n/a' : `${Math.round(value)} ms`;

const LIGHTS: Record<Light, { word: string; dot: string; text: string }> = {
  good: { word: 'OK', dot: 'bg-ok', text: 'text-ok' },
  warn: { word: 'Slow', dot: 'bg-accent', text: 'text-accent' },
  bad: { word: 'Over', dot: 'bg-warn', text: 'text-warn' },
  unknown: { word: 'n/a', dot: 'bg-fg-faint', text: 'text-fg-faint' },
};

/** Status dot and word; the word keeps it readable when colours are off. */
const Status = ({ light }: { light: Light }) => {
  const { word, dot, text } = LIGHTS[light];
  return (
    <span class={`inline-flex items-center gap-1 ${text}`}>
      <span role="img" aria-label={word} class={`size-2 rounded-full ${dot}`} />
      {word}
    </span>
  );
};

/**
 * Performance readout for the diagnostics modal, so the budget in
 * docs/performance.md can be measured on the display itself. The frame loop
 * and the one-second refresh run only while it is mounted (modal open).
 */
export const PerfProbe = () => {
  const [frame, setFrame] = useState<{ fps: number; worstMs: number }>();
  const [, refresh] = useState(0);

  useEffect(() => {
    const stop = sampleFrames(setFrame);
    const timer = setInterval(() => refresh((n) => n + 1), 1000);
    return () => {
      stop();
      clearInterval(timer);
    };
  }, []);

  const taps = tapLatency();
  const heap = heapMb();
  const renderMs = firstRenderMs();
  const paintMs = firstPaintMs();
  const updates = updatesInWindow();
  const lights = {
    render: rateMax(renderMs, PERF_BUDGET.firstRenderMs),
    paint: rateMax(paintMs, PERF_BUDGET.firstPaintMs),
    updates: rateMax(updates, PERF_BUDGET.updatesPerMinute),
    frames: worst(
      rateMin(frame?.fps, PERF_BUDGET.minFps),
      rateMax(frame?.worstMs, PERF_BUDGET.worstFrameMs),
    ),
    taps: rateMax(taps.slowest, PERF_BUDGET.tapMs),
  };
  return (
    <section class="tnum mt-4 font-mono text-small text-fg-dim">
      <h3 class="flex items-center gap-2 text-fg">
        Performance <Status light={worst(...Object.values(lights))} />
      </h3>
      <p>
        First render {ms(renderMs)} <Status light={lights.render} />
      </p>
      <p>
        First paint {ms(paintMs)} <Status light={lights.paint} />
      </p>
      <p>
        Store updates, last 60 s: {updates} <Status light={lights.updates} />
      </p>
      <p>
        Frames: {frame ? `${frame.fps.toFixed(0)} fps` : 'sampling'}, worst{' '}
        {ms(frame?.worstMs)} <Status light={lights.frames} />
      </p>
      <p>
        Tap to frame: last {ms(taps.last)}, slowest {ms(taps.slowest)} (
        {taps.count} in 60 s) <Status light={lights.taps} />
      </p>
      {heap !== undefined && <p>JS heap {heap.toFixed(1)} MB</p>}
    </section>
  );
};

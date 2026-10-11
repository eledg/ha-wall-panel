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

const LIGHTS: Record<Light, { word: string; tone: string }> = {
  good: { word: 'OK', tone: 'bg-ok-soft text-ok' },
  warn: { word: 'Slow', tone: 'bg-accent-soft text-accent' },
  bad: { word: 'Over', tone: 'bg-warn-soft text-warn' },
  unknown: { word: 'n/a', tone: 'bg-surface-2 text-fg-faint' },
};

/** Status pill; the word keeps it readable when colours are off. */
const Status = ({ light }: { light: Light }) => {
  const { word, tone } = LIGHTS[light];
  return (
    <span
      class={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-small font-semibold ${tone}`}
    >
      <span
        role="img"
        aria-label={word}
        class="size-1.5 shrink-0 rounded-full bg-current"
      />
      {word}
    </span>
  );
};

const Row = ({
  label,
  value,
  detail,
  light,
}: {
  label: string;
  value: string;
  detail?: string;
  light: Light;
}) => (
  <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-3 py-3">
    <dt class="min-w-0 text-sm text-fg">{label}</dt>
    <dd class="min-w-0">
      <span class="text-label font-semibold text-fg">{value}</span>
      {detail && <span class="ml-2 text-small text-fg-dim">{detail}</span>}
    </dd>
    <dd>
      <Status light={light} />
    </dd>
  </div>
);

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
    <section class="border-b border-line py-5">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h3 class="text-lg font-semibold text-fg">Performance</h3>
        <Status light={worst(...Object.values(lights))} />
      </div>
      <dl class="divide-y divide-line">
        <Row label="First render" value={ms(renderMs)} light={lights.render} />
        <Row label="First paint" value={ms(paintMs)} light={lights.paint} />
        <Row
          label="Store updates"
          value={String(updates)}
          detail="Last 60 s"
          light={lights.updates}
        />
        <Row
          label="Frames"
          value={frame ? `${frame.fps.toFixed(0)} fps` : 'sampling'}
          detail={`Worst ${ms(frame?.worstMs)}`}
          light={lights.frames}
        />
        <Row
          label="Tap to frame"
          value={ms(taps.last)}
          detail={`Slowest ${ms(taps.slowest)} · ${taps.count} taps in 60 s`}
          light={lights.taps}
        />
      </dl>
      {heap !== undefined && (
        <p class="mt-3 text-small text-fg-dim">JS heap {heap.toFixed(1)} MB</p>
      )}
    </section>
  );
};

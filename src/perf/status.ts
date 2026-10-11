/** Limits for the runtime part of the budget; keep in step with docs/performance.md. */
export const PERF_BUDGET = {
  firstRenderMs: 2000,
  firstPaintMs: 2000,
  updatesPerMinute: 10,
  minFps: 30,
  worstFrameMs: 100,
  tapMs: 100,
} as const;

/** `unknown` means not measured yet. */
export type Light = 'good' | 'warn' | 'bad' | 'unknown';

/** Over the limit by up to this factor is amber; beyond it is red. */
const AMBER = 1.5;

/** For measures where lower is better. */
export const rateMax = (value: number | undefined, limit: number): Light => {
  if (value === undefined) return 'unknown';
  if (value <= limit) return 'good';
  return value <= limit * AMBER ? 'warn' : 'bad';
};

/** For measures where higher is better, such as frames per second. */
export const rateMin = (value: number | undefined, limit: number): Light => {
  if (value === undefined) return 'unknown';
  if (value >= limit) return 'good';
  return value >= limit / AMBER ? 'warn' : 'bad';
};

const RANK: Record<Light, number> = { unknown: 0, good: 1, warn: 2, bad: 3 };

/** The most severe light; `unknown` only when nothing is measured. */
export const worst = (...lights: Light[]): Light =>
  lights.reduce<Light>((a, b) => (RANK[b] > RANK[a] ? b : a), 'unknown');

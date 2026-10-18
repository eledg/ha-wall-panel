import type { HaStore } from '@/services/ha/store.ts';

/** Store updates and tap latencies are kept for this long. */
export const WINDOW_MS = 60_000;

const updates: number[] = [];
const taps: { at: number; ms: number }[] = [];

const prune = <T>(items: T[], at: (item: T) => number, now: number) => {
  const first = items.findIndex((item) => at(item) > now - WINDOW_MS);
  items.splice(0, first === -1 ? items.length : first);
};

/** Store notifications in the last minute: how often the UI is asked to redraw. */
export const updatesInWindow = (now = performance.now()) => {
  prune(updates, (at) => at, now);
  return updates.length;
};

/** Delay from the latest taps to the next frame, and the slowest in the window. */
export const tapLatency = (now = performance.now()) => {
  prune(taps, (tap) => tap.at, now);
  const last = taps.at(-1)?.ms;
  const slowest =
    taps.length > 0 ? Math.max(...taps.map((t) => t.ms)) : undefined;
  return { last, slowest, count: taps.length };
};

/** Milliseconds from navigation start until the app's first render finished. */
export const firstRenderMs = (): number | undefined =>
  performance.getEntriesByName('app-rendered', 'mark')[0]?.startTime;

/** Browser-reported first contentful paint, which includes script download. */
export const firstPaintMs = (): number | undefined =>
  performance.getEntriesByName('first-contentful-paint', 'paint')[0]?.startTime;

/** Used JS heap in MB. Chromium only, so undefined where it is missing. */
export const heapMb = () => {
  const memory = (performance as { memory?: { usedJSHeapSize: number } })
    .memory;
  return memory ? memory.usedJSHeapSize / 1024 / 1024 : undefined;
};

/**
 * Frames per second over each one-second stretch, plus the longest single
 * frame. Runs only between `start` and the returned stop, so the page never
 * has a permanent animation loop.
 */
export const sampleFrames = (
  onSample: (sample: { fps: number; worstMs: number }) => void,
) => {
  let previous: number | undefined;
  let frames = 0;
  let worst = 0;
  let windowStart = performance.now();
  let id = 0;
  const tick = (time: number) => {
    if (previous !== undefined) {
      frames++;
      worst = Math.max(worst, time - previous);
    }
    previous = time;
    if (time - windowStart >= 1000) {
      onSample({ fps: (frames * 1000) / (time - windowStart), worstMs: worst });
      frames = 0;
      worst = 0;
      windowStart = time;
    }
    id = requestAnimationFrame(tick);
  };
  id = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(id);
};

/**
 * Starts the always-on counters: the first-render mark, store notifications and
 * tap-to-next-frame delay. Each is a timestamp or a single frame callback per
 * event, so it costs nothing while the screen is idle.
 */
export const startPerf = (store: HaStore) => {
  performance.mark('app-rendered');
  const stopStore = store.subscribe(() => updates.push(performance.now()));
  const onTap = () => {
    const start = performance.now();
    requestAnimationFrame(() => {
      const ms = performance.now() - start;
      taps.push({ at: start, ms });
    });
  };
  document.addEventListener('pointerdown', onTap, {
    capture: true,
    passive: true,
  });
  return () => {
    stopStore();
    document.removeEventListener('pointerdown', onTap, { capture: true });
  };
};

import { formatHumidity, formatPercent, formatTemp } from '@/lib/format.ts';
import type { Interval, Sample } from '@/services/ha/history.ts';

import { modeLabel } from './ac-model.ts';
import type { AcView } from './ac-model.ts';
import type { HeatingView } from './heating-model.ts';

/** The chart's drawing space; the SVG stretches it to fit. */
export const CHART_W = 600;
export const CHART_H = 200;

export type Comfort = { label: string; warn: boolean };

/** How the room feels, from its temperature and humidity (either may be missing). */
export const comfort = (
  temperature: number | undefined,
  humidity: number | undefined,
): Comfort => {
  if (humidity !== undefined && humidity > 65) {
    return { label: 'Humid', warn: true };
  }
  if (humidity !== undefined && humidity < 30) {
    return { label: 'Dry air', warn: true };
  }
  if (temperature !== undefined && temperature < 18) {
    return { label: 'Cool', warn: true };
  }
  if (temperature !== undefined && temperature > 25) {
    return { label: 'Warm', warn: true };
  }
  return { label: 'Comfortable', warn: false };
};

/** The lowest and highest value, or `undefined` for no samples. */
export const extent = (samples: Sample[] | undefined) => {
  if (!samples || samples.length === 0) return undefined;
  const values = samples.map((s) => s.value);
  return { min: Math.min(...values), max: Math.max(...values) };
};

/** The temperature axis: whole degrees with half a degree of room each side. */
export const tempScale = (min: number, max: number) => ({
  min: Math.floor(min - 0.5),
  max: Math.ceil(max + 0.5),
});

const x = (at: number, start: number, end: number) =>
  ((at - start) / (end - start)) * CHART_W;

const y = (value: number, lo: number, hi: number) =>
  CHART_H - ((value - lo) / (hi - lo)) * CHART_H;

const round = (value: number) => Math.round(value * 10) / 10;

/** An SVG path through the samples, scaled so `lo` is the bottom and `hi` the top. */
export const linePath = (
  samples: Sample[],
  start: number,
  end: number,
  lo: number,
  hi: number,
) =>
  samples
    .map(
      (s, i) =>
        `${i === 0 ? 'M' : 'L'}${round(x(s.at, start, end))} ${round(y(s.value, lo, hi))}`,
    )
    .join(' ');

/** Where the "on" stretches sit across the chart's width. */
export const bands = (intervals: Interval[], start: number, end: number) =>
  intervals
    .filter((i) => i.on)
    .map((i) => ({
      x: round(x(i.start, start, end)),
      width: round(x(i.end, start, end) - x(i.start, start, end)),
    }));

/** The height of a target line, or `undefined` when it falls outside the axis. */
export const targetY = (target: number | undefined, lo: number, hi: number) =>
  target === undefined || target < lo || target > hi
    ? undefined
    : round(y(target, lo, hi));

/** The line on the heating button. */
export const heatingLine = (view: HeatingView) => {
  if (view.state === 'paused') return 'Paused';
  if (!view.on) return 'Off';
  const target =
    view.target === undefined ? '' : `Target ${formatTemp(view.target)}° · `;
  if (view.power !== undefined) {
    return `${target}${view.power > 0 ? `heating ${formatPercent(view.power)}` : 'idle'}`;
  }
  return `${target}${view.demand ? 'heating' : 'idle'}`;
};

/** The line on the AC button. */
export const acLine = (view: AcView) => {
  if (!view.on) return 'Off';
  const mode = view.mode ? modeLabel(view.mode) : 'On';
  return view.target === undefined
    ? mode
    : `${mode} · target ${formatTemp(view.target)}°`;
};

/** The line under the sheet's title: the reading, then how the room feels. */
export const roomStatus = (
  label: string,
  temperature: number | undefined,
  humidity: number | undefined,
  feel: Comfort,
  offline: boolean,
) => {
  if (temperature === undefined) return `${label} unavailable`;
  const parts = [`${formatTemp(temperature)}°`];
  if (humidity !== undefined)
    parts.push(`${formatHumidity(humidity)} humidity`);
  parts.push(feel.label);
  const status = parts.join(' · ');
  return offline ? `Offline · ${status}` : status;
};

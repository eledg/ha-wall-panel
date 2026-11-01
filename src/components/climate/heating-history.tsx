import { powerSegments, powerStrength } from '@/lib/climate/heating-model.ts';
import { formatTime } from '@/lib/format.ts';
import type { Interval, Sample } from '@/services/ha/history.ts';

/** How far back the history reaches. */
export const HISTORY_HOURS = 6;

const time = (at: number) => formatTime(at);

/**
 * The accent dimmed in proportion to the power, keeping its hue so a low power
 * reads as dark orange rather than a muddy mix with the off colour.
 */
const fill = (percent: number) => {
  const k = powerStrength(percent) / 100;
  return `oklch(from var(--color-accent) calc(l * ${0.45 + 0.55 * k}) calc(c * ${0.4 + 0.6 * k}) h)`;
};

/**
 * When the boiler was called for heat over a window: on/off bands (accent for
 * on) with time labels. `intervals` is `undefined` while loading and `[]` when
 * HA has nothing to show; neither draws a blank bar. With `power` samples
 * (percent) the bands follow them instead, a stronger accent for more power.
 */
export const HeatingHistory = ({
  intervals,
  power,
  start,
  end,
}: {
  intervals: Interval[] | undefined;
  /** Heating power over the same window, when the tile has a power sensor. */
  power?: Sample[];
  /** The window `intervals` cover; absent until the first read. */
  start?: number;
  end?: number;
}) => {
  const hours = HISTORY_HOURS;
  const segments =
    power && start !== undefined && end !== undefined
      ? powerSegments(power, start, end)
      : [];
  const graded = segments.length > 0;
  const peak = Math.max(0, ...segments.map((s) => s.percent));
  const labels =
    start === undefined || end === undefined
      ? []
      : [0, 1 / 3, 2 / 3, 1].map((f) => start + f * (end - start));
  return (
    <section class="mt-auto shrink-0" aria-label="Heating demand history">
      <div class="mb-2 flex items-center justify-between text-xs text-fg-dim">
        <h3>Demand · last {hours} hours</h3>
        {graded ? (
          <span class="flex items-center gap-1">
            <span>Low</span>
            <span
              class="h-2 w-8"
              style={{
                backgroundImage: `linear-gradient(to right, ${fill(1)}, ${fill(100)})`,
              }}
            />
            <span>High</span>
          </span>
        ) : (
          <span class="flex items-center gap-1">
            <span class="size-2 bg-accent" />
            <span>Heating</span>
          </span>
        )}
      </div>
      {!graded && (intervals === undefined || intervals.length === 0) ? (
        <div class="grid h-6 place-items-center rounded border border-line bg-surface-2 text-xs text-fg-dim">
          {intervals === undefined ? 'Loading…' : 'No demand history available'}
        </div>
      ) : (
        <>
          <div
            class="flex h-6 overflow-hidden rounded border border-line"
            role="img"
            aria-label={
              graded
                ? `Heating power peaked at ${Math.round(peak)}% over the last ${hours} hours`
                : `${intervals!.filter((i) => i.on).length} heating periods over the last ${hours} hours`
            }
          >
            {segments.map((segment) => (
              <div
                key={segment.start}
                style={{
                  flexGrow: segment.end - segment.start,
                  ...(segment.percent > 0 && {
                    backgroundColor: fill(segment.percent),
                  }),
                }}
                class={`basis-0 ${segment.percent > 0 ? '' : 'bg-surface-2'}`}
                title={`${time(segment.start)}–${time(segment.end)} · ${Math.round(segment.percent)}%`}
              />
            ))}
            {!graded &&
              intervals!.map((interval) => (
                <div
                  key={interval.start}
                  style={{ flexGrow: interval.end - interval.start }}
                  class={`basis-0 ${interval.on ? 'bg-accent' : 'bg-surface-2'}`}
                  title={`${time(interval.start)}–${time(interval.end)} · ${interval.on ? 'Heating' : 'Off'}`}
                />
              ))}
          </div>
          <div class="tnum mt-1 flex justify-between text-xs text-fg-dim">
            {labels.map((at) => (
              <span key={at}>{time(at)}</span>
            ))}
          </div>
        </>
      )}
    </section>
  );
};

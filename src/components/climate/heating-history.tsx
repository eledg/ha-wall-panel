import { formatTime } from '@/lib/format.ts';
import type { Interval } from '@/services/ha/history.ts';

/** How far back the history reaches. */
export const HISTORY_HOURS = 6;

const time = (at: number) => formatTime(at);

/**
 * When the boiler was called for heat over a window: on/off bands (accent for
 * on) with time labels. `intervals` is `undefined` while loading and `[]` when
 * HA has nothing to show; neither draws a blank bar.
 */
export const HeatingHistory = ({
  intervals,
  start,
  end,
}: {
  intervals: Interval[] | undefined;
  /** The window `intervals` cover; absent until the first read. */
  start?: number;
  end?: number;
}) => {
  const hours = HISTORY_HOURS;
  const labels =
    start === undefined || end === undefined
      ? []
      : [0, 1 / 3, 2 / 3, 1].map((f) => start + f * (end - start));
  return (
    <section class="mt-auto shrink-0" aria-label="Heating demand history">
      <div class="mb-2 flex items-center justify-between text-xs text-fg-dim">
        <h3>Demand · last {hours} hours</h3>
        <span class="flex items-center gap-1">
          <span class="size-2 bg-accent" />
          <span>Heating</span>
        </span>
      </div>
      {intervals === undefined || intervals.length === 0 ? (
        <div class="grid h-6 place-items-center rounded border border-line bg-surface-2 text-xs text-fg-dim">
          {intervals === undefined ? 'Loading…' : 'No demand history available'}
        </div>
      ) : (
        <>
          <div
            class="flex h-6 overflow-hidden rounded border border-line"
            role="img"
            aria-label={`${intervals.filter((i) => i.on).length} heating periods over the last ${hours} hours`}
          >
            {intervals.map((interval) => (
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

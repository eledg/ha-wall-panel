import { useEffect, useState } from 'preact/hooks';

import { formatTime } from '../format.ts';
import type { GridArea } from '../grid.ts';

const date = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** Milliseconds until the next whole minute (a full minute on the boundary). */
export const msToNextMinute = (now: Date) =>
  60_000 - (now.getSeconds() * 1000 + now.getMilliseconds());

const systemNow = () => new Date();

/**
 * Re-renders on every whole minute. Each wait is recomputed from the clock
 * rather than using a fixed interval, so timer lateness never accumulates.
 */
export const useMinute = (now: () => Date = systemNow) => {
  const [current, setCurrent] = useState(now);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setCurrent(now());
        schedule();
      }, msToNextMinute(now()));
    };
    // Catch a minute that passed between first render and this effect.
    setCurrent(now());
    schedule();
    return () => clearTimeout(timer);
  }, [now]);
  return current;
};

/** Large time and UK-format date. No tile chrome, as in the design. */
export const ClockTile = ({
  area,
  now,
}: {
  area: GridArea;
  now?: () => Date;
}) => {
  const current = useMinute(now);
  return (
    <div
      style={{ gridArea: area }}
      class="flex min-w-0 flex-col justify-center px-2"
    >
      <div class="tnum text-[88px] leading-none font-semibold tracking-tight">
        {formatTime(current)}
      </div>
      <div class="mt-2 truncate text-2xl text-fg-dim">
        {date.format(current)}
      </div>
    </div>
  );
};

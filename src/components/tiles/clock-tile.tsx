import type { Placement } from '@/config/config.ts';
import { useMinute } from '@/hooks/use-minute.ts';
import { formatTime } from '@/lib/format.ts';
import { placeStyle } from '@/lib/grid.ts';

const date = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** Large time and UK-format date. No tile chrome, as in the design. */
export const ClockTile = ({
  place,
  now,
}: {
  place: Placement;
  now?: () => Date;
}) => {
  const current = useMinute(now);
  return (
    <div
      style={placeStyle(place)}
      class="tile-place flex min-w-0 flex-col justify-center px-2"
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

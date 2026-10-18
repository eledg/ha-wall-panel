import type { ComponentChildren } from 'preact';

import { Tile, type TileState, Unavailable } from './tile.tsx';
import type { GridArea } from '../grid.ts';
import { useOffline } from '../ha/connection.tsx';

/** `22.2°`: the design's big reading, with the degree symbol raised. */
export const Temperature = ({
  value,
  muted = false,
  matchDegree = false,
}: {
  /** Already formatted, e.g. by `formatTemp`. */
  value: string;
  /** Dimmed, for a reading that is context rather than the thing in focus. */
  muted?: boolean;
  /** Colour the degree symbol like the digits, not dimmed (e.g. on a lit tile). */
  matchDegree?: boolean;
}) => (
  <span
    class={`tnum whitespace-nowrap text-4xl font-semibold ${muted ? 'text-fg-dim' : ''}`}
  >
    {value}
    <span
      class={`relative -top-[11.5px] ml-[2px] text-xl ${matchDegree ? '' : 'text-fg-dim'}`}
    >
      °
    </span>
  </span>
);

export type DeviceTone = 'accent' | 'neutral';

/**
 * Shell for the single-width device tiles from the design: an icon and label
 * header with an optional state icon on the right, an optional status line
 * directly above the value, and the value anchored at the bottom. An `accent`
 * tone lights the tile unless HA is disconnected.
 */
export const DeviceTile = ({
  area,
  state,
  icon,
  label,
  right,
  status,
  value,
  tone = 'neutral',
  flash,
  onTap,
  centerValue = false,
}: {
  area: GridArea;
  state?: TileState;
  icon: ComponentChildren;
  label: string;
  right?: ComponentChildren;
  /** A small line directly above the value. */
  status?: ComponentChildren;
  value?: ComponentChildren;
  tone?: DeviceTone;
  flash?: boolean;
  onTap?: () => void;
  /** Centre the value in the space below the header instead of anchoring it. */
  centerValue?: boolean;
}) => {
  const offline = useOffline();
  const accent = tone === 'accent';
  const lit = accent && !offline;

  return (
    <Tile
      area={area}
      state={state}
      onTap={onTap}
      flash={flash}
      class={lit ? 'border-accent! bg-accent-soft!' : ''}
    >
      <div class="flex h-full flex-col justify-between">
        <div
          class={`flex items-center gap-1.5 text-sm ${accent ? 'text-accent' : 'text-fg-dim'}`}
        >
          {icon}
          {label}
          {right && <span class="ml-auto min-w-0 truncate">{right}</span>}
        </div>
        {state === 'unavailable' ? (
          <Unavailable />
        ) : (
          <div
            class={`flex flex-col gap-1 ${centerValue ? 'min-h-0 flex-1 items-center justify-center' : 'items-start'} ${accent ? 'text-accent' : 'text-fg'}`}
          >
            {status}
            {value}
          </div>
        )}
      </div>
    </Tile>
  );
};

import type { ComponentChildren } from 'preact';

import type { Placement } from '@/config/config.ts';
import { useOffline } from '@/hooks/use-offline.ts';

import { Tile, type TileState, Unavailable } from './tile.tsx';

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
      class={`relative top-[-11.5px] ml-0.5 text-xl ${matchDegree ? '' : 'text-fg-dim'}`}
    >
      °
    </span>
  </span>
);

/** The big value of a tile whose reading is missing: `— n/a`. */
export const MissingValue = () => (
  <div class="tnum text-4xl font-semibold text-fg-faint">
    —<span class="ml-1 text-sm text-warn">n/a</span>
  </div>
);

export type DeviceTone = 'accent' | 'manual' | 'neutral';

/**
 * Shell for the single-width device tiles from the design: an icon and label
 * header with an optional state icon on the right, an optional status line
 * directly above the value, and the value anchored at the bottom. An `accent`
 * (or red `manual`) tone lights the tile unless HA is disconnected.
 */
export const DeviceTile = ({
  place,
  state,
  icon,
  label,
  right,
  status,
  value,
  tone = 'neutral',
  flash,
  onTap,
  disabled,
  pressed,
  centerValue = false,
}: {
  place: Placement;
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
  /** Stops a tap, e.g. while the entity is unavailable. */
  disabled?: boolean;
  /** The `aria-pressed` state of a tappable tile that is a switch. */
  pressed?: boolean;
  /** Centre the value in the space below the header instead of anchoring it. */
  centerValue?: boolean;
}) => {
  const offline = useOffline();
  const manual = tone === 'manual';
  const accent = tone === 'accent' || manual;
  const lit = accent && !offline;
  const colour = manual ? 'text-heating-manual' : 'text-accent';
  let tileClass = '';
  if (lit) {
    tileClass = manual
      ? 'border-heating-manual! bg-heating-manual-soft!'
      : 'border-accent! bg-accent-soft!';
  }

  return (
    <Tile
      place={place}
      state={state}
      onTap={onTap}
      disabled={disabled}
      pressed={pressed}
      flash={flash}
      class={tileClass}
    >
      <div class="flex h-full flex-col justify-between">
        <div
          class={`flex items-center gap-1.5 text-sm ${accent ? colour : 'text-fg-dim'}`}
        >
          {icon}
          {label}
          {right && <span class="ml-auto min-w-0 truncate">{right}</span>}
        </div>
        {state === 'unavailable' ? (
          <Unavailable />
        ) : (
          <div
            class={`flex flex-col gap-1 ${centerValue ? 'min-h-0 flex-1 items-center justify-center' : 'items-start'} ${accent ? colour : 'text-fg'}`}
          >
            {status}
            {value}
          </div>
        )}
      </div>
    </Tile>
  );
};

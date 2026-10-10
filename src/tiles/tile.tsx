import type { ComponentChildren } from 'preact';

import type { GridArea } from '../grid.ts';
import { AlertIcon } from '../icons/alert-icon.tsx';

export type TileState = 'loading' | 'normal' | 'unavailable' | 'stale';

/** Shown inside a tile whose entity is unavailable. */
export const Unavailable = ({ label = 'Unavailable' }: { label?: string }) => (
  <div class="flex items-center gap-2 text-warn">
    <AlertIcon class="size-5 shrink-0" />
    <span class="text-base font-medium">{label}</span>
  </div>
);

/**
 * Shared tile shell from the design: border, surface, loading skeleton and
 * stale / warning badges. Renders a button when tappable, with an opaque
 * background (the display paints bare buttons grey, see docs/display.md).
 */
export const Tile = ({
  area,
  state = 'normal',
  onTap,
  disabled = false,
  pressed,
  warn,
  class: className = '',
  children,
}: {
  area: GridArea;
  state?: TileState;
  onTap?: () => void;
  disabled?: boolean;
  pressed?: boolean;
  warn?: string;
  class?: string;
  children?: ComponentChildren;
}) => {
  const stale = state === 'stale';
  const base = `relative min-w-0 overflow-hidden rounded-tile border border-line bg-surface p-4 text-left ${className}`;
  const body =
    state === 'loading' ? (
      <div class="flex h-full flex-col justify-center gap-2">
        <div class="h-4 w-1/3 rounded bg-surface-2" />
        <div class="h-8 w-2/3 rounded bg-surface-2" />
      </div>
    ) : (
      <div class={`h-full ${stale ? 'opacity-60' : ''}`}>{children}</div>
    );
  const badges = (
    <div class="pointer-events-none absolute top-3 right-3 flex gap-1">
      {stale && (
        <span class="rounded-full border border-line px-2 py-0.5 text-[11px] text-fg-dim">
          stale
        </span>
      )}
      {warn && (
        <span class="flex items-center gap-1 rounded-full bg-warn-soft px-2 py-0.5 text-[11px] text-warn">
          <AlertIcon class="size-3" />
          {warn}
        </span>
      )}
    </div>
  );

  if (onTap) {
    return (
      <button
        type="button"
        style={{ gridArea: area }}
        class={`${base} tap min-h-14 disabled:opacity-50`}
        aria-pressed={pressed}
        disabled={disabled}
        onClick={onTap}
      >
        {body}
        {badges}
      </button>
    );
  }
  return (
    <div style={{ gridArea: area }} class={base}>
      {body}
      {badges}
    </div>
  );
};

import { useEffect, useRef, useState } from 'preact/hooks';

import { BulbIcon } from '@/components/icons/bulb-icon.tsx';
import type { TileConfig } from '@/config/config.ts';
import { useOffline } from '@/hooks/use-offline.ts';
import { useSnapshot } from '@/hooks/use-snapshot.ts';
import { haStore } from '@/services/ha/instance.ts';
import type { HaStore } from '@/services/ha/store.ts';

import { DeviceTile } from './base/device-tile.tsx';
import { Tile, type TileState, tileState, Unavailable } from './base/tile.tsx';

/** How long the tile flashes after a rolled-back toggle (the design's 900 ms). */
const FLASH_MS = 900;
/** Safety net: drop the optimistic state if HA never reports the change. */
const SETTLE_MS = 5000;

/**
 * The toggle's state: HA's `state` with a guess laid over it from the moment of
 * a tap, `usable` while HA reports on or off, and `failed` for a moment after
 * a service call is rolled back.
 */
const useToggle = (label: string, entity: string, store: HaStore) => {
  const state = useSnapshot(store, (s) => s.entities[entity]?.state);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const pendingRef = useRef(false);
  const on = optimistic ?? state === 'on';
  const usable = state === 'on' || state === 'off';

  // HA reported a change, so the real state takes over from the guess.
  useEffect(() => setOptimistic(null), [state]);
  useEffect(() => {
    if (optimistic === null) return;
    const timer = setTimeout(() => setOptimistic(null), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [optimistic]);
  useEffect(() => {
    if (!failed) return;
    const timer = setTimeout(() => setFailed(false), FLASH_MS);
    return () => clearTimeout(timer);
  }, [failed]);

  const toggle = () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setFailed(false);
    setOptimistic(!on);
    store
      .callService('switch', entity, 'toggle')
      .catch((err: unknown) => {
        console.error(`Toggle ${label} failed`, err);
        setOptimistic(null);
        setFailed(true);
      })
      .finally(() => {
        pendingRef.current = false;
      });
  };

  return { state, on, usable, failed, toggle };
};

/**
 * A tile that shows an entity's on/off state and calls `toggle` on tap. One
 * column wide it is a stacked `DeviceTile` like the other single-width tiles;
 * wider, an icon beside the label and state.
 *
 * A tap flips the tile at once (optimistic). If the service call fails the
 * tile reverts to HA's state and flashes in the warning colours.
 */
export const ToggleTile = ({
  tile,
  store = haStore,
}: {
  tile: TileConfig<'toggle'>;
  store?: HaStore;
}) => {
  const { label, entities } = tile;
  const { state, on, usable, failed, toggle } = useToggle(
    label,
    entities.entity,
    store,
  );
  const offline = useOffline();

  if (tile.w === 1) {
    return (
      <DeviceTile
        place={tile}
        state={tileState([state], usable)}
        icon={<BulbIcon class="size-4" on={on} />}
        label={label}
        value={
          <span
            class={`text-4xl font-semibold ${on ? 'text-accent' : 'text-fg'}`}
          >
            {on ? 'On' : 'Off'}
          </span>
        }
        tone={on && !failed ? 'accent' : 'neutral'}
        flash={failed}
        pressed={on}
        disabled={!usable}
        onTap={toggle}
      />
    );
  }

  let tileStatus: TileState = 'normal';
  if (state === undefined) tileStatus = 'loading';
  else if (offline) tileStatus = 'stale';

  return (
    <Tile
      place={tile}
      state={tileStatus}
      pressed={on}
      flash={failed}
      disabled={!usable}
      class={on && !offline && !failed ? 'border-accent! bg-accent-soft!' : ''}
      onTap={toggle}
    >
      <div class="flex h-full items-center gap-4">
        <div
          class={`grid size-14 shrink-0 place-items-center rounded-full ${
            on ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-dim'
          }`}
        >
          <BulbIcon on={on} />
        </div>
        <div class="min-w-0">
          <div class="truncate text-lg text-fg-dim">{label}</div>
          {usable ? (
            <div
              class={`text-3xl font-semibold ${on ? 'text-accent' : 'text-fg'}`}
            >
              {on ? 'On' : 'Off'}
            </div>
          ) : (
            <Unavailable />
          )}
        </div>
      </div>
    </Tile>
  );
};

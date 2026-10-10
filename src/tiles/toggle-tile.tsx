import type { GridArea } from '../grid.ts';
import { Tile, Unavailable } from './tile.tsx';
import { haStore } from '../ha/instance.ts';
import type { EntityKey, HaStore, ServiceName } from '../ha/store.ts';
import { useSnapshot } from '../ha/use-snapshot.ts';
import { BulbIcon } from '../icons/bulb-icon.tsx';

/** Config keys whose domain accepts `toggle` (a `switch` today, a `light` later). */
export type ToggleKey = {
  [K in EntityKey]: 'toggle' extends ServiceName<K> ? K : never;
}[EntityKey];

/**
 * A tile that shows an entity's on/off state and calls `toggle` on tap. The
 * domain comes from the config, so pointing the key at a `light.*` entity
 * needs no change here.
 */
export const ToggleTile = ({
  entity,
  label,
  area,
  store = haStore,
}: {
  entity: ToggleKey;
  label: string;
  area: GridArea;
  store?: HaStore;
}) => {
  const state = useSnapshot(store).entities[entity]?.state;
  const on = state === 'on';
  const usable = state === 'on' || state === 'off';

  return (
    <Tile
      area={area}
      state={state === undefined ? 'loading' : 'normal'}
      pressed={on}
      disabled={!usable}
      class={on ? 'border-accent! bg-accent-soft!' : ''}
      onTap={() =>
        void store
          .callService(entity, 'toggle' as ServiceName<typeof entity>)
          .catch((err: unknown) => console.error(`Toggle ${label} failed`, err))
      }
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

import { config } from '../config.ts';
import { haStore } from '../ha/instance.ts';
import type { EntityKey, HaStore, ServiceName } from '../ha/store.ts';
import { useSnapshot } from '../ha/use-snapshot.ts';

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
  store = haStore,
}: {
  entity: ToggleKey;
  label: string;
  store?: HaStore;
}) => {
  const state = useSnapshot(store).entities[entity]?.state;
  const on = state === 'on';
  const usable = state === 'on' || state === 'off';
  const { domain } = config.entities[entity];

  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={!usable}
      data-domain={domain}
      class={`flex flex-col justify-between rounded-tile p-4 text-left disabled:opacity-50 ${
        on ? 'bg-accent text-bg' : 'bg-surface active:bg-surface-active'
      }`}
      onClick={() =>
        void store
          .callService(entity, 'toggle' as ServiceName<typeof entity>)
          .catch((err: unknown) => console.error(`Toggle ${label} failed`, err))
      }
    >
      <span class="text-label">{label}</span>
      <span class="text-value">
        {state === 'on' ? 'On' : state === 'off' ? 'Off' : 'Unavailable'}
      </span>
    </button>
  );
};

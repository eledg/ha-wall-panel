import { config } from '../config.ts';
import { haStore } from './instance.ts';
import type { EntityKey, HaStore } from './store.ts';
import { useSnapshot } from './use-snapshot.ts';

/** Live state for each configured entity, plus what the store subscribes to. */
export const HaDebug = ({ store = haStore }: { store?: HaStore }) => {
  const { status, error, entities } = useSnapshot(store);
  const keys = Object.keys(config.entities) as EntityKey[];

  return (
    <section class="pt-5">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h3 class="text-lg font-semibold text-fg">Subscribed entities</h3>
        <span class="tnum text-sm text-fg-dim">{keys.length} entities</span>
      </div>
      {error && <p class="font-mono text-small text-warn">{error}</p>}
      <dl class="divide-y divide-line">
        {keys.map((key) => {
          const entity = entities[key];
          const unit = entity?.attributes.unit_of_measurement;
          return (
            <div
              key={key}
              class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4"
            >
              <dt class="min-w-0 break-all font-mono text-sm text-fg-dim">
                {config.entities[key].id}
              </dt>
              <dd class="tnum text-sm font-medium text-fg">
                {status === 'connected'
                  ? `${entity?.state ?? 'no state'}${entity && unit ? ` ${unit}` : ''}`
                  : 'Unavailable'}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
};

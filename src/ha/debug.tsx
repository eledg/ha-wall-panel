import { config } from '../config.ts';
import { haStore } from './instance.ts';
import type { EntityKey, HaStore } from './store.ts';
import { useSnapshot } from './use-snapshot.ts';

/** Live state for each configured entity, plus what the store subscribes to. */
export const HaDebug = ({ store = haStore }: { store?: HaStore }) => {
  const { status, error, subscribed, entities } = useSnapshot(store);
  const keys = Object.keys(config.entities) as EntityKey[];

  return (
    <section class="mt-4 space-y-2 font-mono text-small text-fg-dim">
      <p>
        HA: {status}
        {error && ` (${error})`}
      </p>
      <p>Subscribed: {subscribed.join(', ') || 'none'}</p>
      <ul>
        {keys.map((key) => {
          const entity = entities[key];
          const unit = entity?.attributes.unit_of_measurement;
          return (
            <li key={key}>
              {config.entities[key].id}: {entity?.state ?? 'no state'}
              {entity && unit ? ` ${unit}` : ''}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

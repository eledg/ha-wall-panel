import { useEffect, useState } from 'preact/hooks';

import { config } from '../config.ts';
import { haStore } from './store.ts';
import type { EntityKey, HaStore } from './store.ts';

const useSnapshot = (store: HaStore) => {
  const [snapshot, setSnapshot] = useState(store.getSnapshot);
  useEffect(() => {
    const sync = () => setSnapshot(store.getSnapshot());
    sync();
    return store.subscribe(sync);
  }, [store]);
  return snapshot;
};

/** Live state for each configured entity, plus what the store subscribes to. */
export const HaDebug = ({ store = haStore }: { store?: HaStore }) => {
  const { status, error, subscribed, entities } = useSnapshot(store);
  const keys = Object.keys(config.entities) as EntityKey[];

  return (
    <section class="fixed bottom-2 left-2 max-w-md space-y-1 font-mono text-xs opacity-70">
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
      {status === 'connected' && (
        <button
          type="button"
          class="rounded border px-2 py-1"
          onClick={() => void store.callService('officeLight', 'toggle')}
        >
          Toggle office light
        </button>
      )}
    </section>
  );
};

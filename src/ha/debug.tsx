import { useEffect, useState } from 'preact/hooks';

import { config } from '../config.ts';
import { haStore } from './instance.ts';
import type { MockControls } from './mock.ts';
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

const MockPanel = ({ mock }: { mock: MockControls }) => {
  const light = config.entities.officeLight.id;
  const button = 'rounded border px-2 py-1';
  return (
    <fieldset class="flex flex-wrap gap-1 border-t pt-1">
      <legend>Mock HA</legend>
      <button
        type="button"
        class={button}
        onClick={() =>
          mock.setState(
            light,
            mock.getState(light)?.state === 'on' ? 'off' : 'on',
          )
        }
      >
        HA flips light
      </button>
      <button
        type="button"
        class={button}
        onClick={() => mock.setUnavailable(light)}
      >
        Light unavailable
      </button>
      <button
        type="button"
        class={button}
        onClick={() => mock.setState(light, 'off')}
      >
        Light back
      </button>
    </fieldset>
  );
};

/** Live state for each configured entity, plus what the store subscribes to. */
export const HaDebug = ({
  store = haStore,
  mock,
}: {
  store?: HaStore;
  /** Set under `pnpm dev:mock`: adds buttons that drive the fake HA. */
  mock?: MockControls;
}) => {
  const { status, error, subscribed, entities } = useSnapshot(store);
  const keys = Object.keys(config.entities) as EntityKey[];

  return (
    <section class="fixed bottom-2 left-2 max-w-md space-y-1 font-mono text-xs opacity-70">
      <p>
        HA{mock ? ' (mock)' : ''}: {status}
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
      {mock && <MockPanel mock={mock} />}
    </section>
  );
};

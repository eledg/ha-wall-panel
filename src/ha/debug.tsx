import { config } from '../config.ts';
import { haStore } from './instance.ts';
import type { MockControls } from './mock.ts';
import type { EntityKey, HaStore } from './store.ts';
import { useSnapshot } from './use-snapshot.ts';

const MockPanel = ({ mock }: { mock: MockControls }) => {
  const light = config.entities.officeLight.id;
  const button = 'min-h-12 rounded border border-line px-4';
  return (
    <fieldset class="flex flex-wrap gap-2 border-t border-line pt-2">
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
    <section class="mt-4 space-y-2 font-mono text-small text-fg-dim">
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
      {mock && <MockPanel mock={mock} />}
    </section>
  );
};

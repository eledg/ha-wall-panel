import { useState } from 'preact/hooks';

import { config } from '../config.ts';
import { haStore } from './instance.ts';
import type { MockControls } from './mock.ts';
import type { HaStore } from './store.ts';
import { useSnapshot } from './use-snapshot.ts';

const Chip = ({
  active = false,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: string;
}) => (
  <button
    type="button"
    aria-pressed={active}
    class={`min-h-10 rounded border px-3 text-sm ${
      active
        ? 'border-accent bg-accent-soft text-accent'
        : 'border-line bg-surface-2'
    }`}
    onClick={onClick}
  >
    {children}
  </button>
);

const Group = ({
  label,
  children,
}: {
  label: string;
  children: preact.ComponentChildren;
}) => (
  <fieldset class="mb-3">
    <legend class="mb-1 text-xs tracking-wide text-fg-dim uppercase">
      {label}
    </legend>
    <div class="flex flex-wrap gap-1.5">{children}</div>
  </fieldset>
);

/**
 * Dev panel for `pnpm dev:mock`, beside the tiles rather than over them, so
 * the effect of each button is visible. Mirrors the Lovable prototype's panel.
 */
export const MockDock = ({
  mock,
  store = haStore,
}: {
  mock: MockControls;
  store?: HaStore;
}) => {
  const [open, setOpen] = useState(false);
  const [scenario, setScenario] = useState(mock.weatherScenarios[0]?.id);
  const [connected, setConnected] = useState(true);
  const [failing, setFailing] = useState(false);
  const { entities } = useSnapshot(store);
  const id = config.entities.weather.id;
  const state = entities.weather?.state;

  return (
    <>
      <button
        type="button"
        class="fixed bottom-edge left-edge min-h-12 rounded border border-line bg-surface px-3 font-mono text-small text-fg-dim"
        onClick={() => setOpen(!open)}
      >
        Mock
      </button>
      {open && (
        <aside
          aria-label="Mock HA"
          class="fixed top-edge right-edge bottom-24 z-10 w-80 overflow-auto rounded-tile border border-line bg-surface p-3"
        >
          <p class="mb-3 font-mono text-small text-fg-dim">
            {id}: {state ?? 'missing'}
          </p>
          <Group label="Weather">
            {mock.weatherScenarios.map(({ id: key, label }) => (
              <Chip
                key={key}
                active={scenario === key}
                onClick={() => {
                  setScenario(key);
                  mock.setWeather(key);
                }}
              >
                {label}
              </Chip>
            ))}
          </Group>
          <Group label="Entity">
            <Chip onClick={() => mock.setUnavailable(id)}>Unavailable</Chip>
            <Chip onClick={() => mock.removeEntity(id)}>Missing</Chip>
            <Chip onClick={() => scenario && mock.setWeather(scenario)}>
              Restore
            </Chip>
          </Group>
          <Group label="Connection">
            <Chip
              active={connected}
              onClick={() => {
                setConnected(true);
                mock.setConnected(true);
              }}
            >
              Connected
            </Chip>
            <Chip
              active={!connected}
              onClick={() => {
                setConnected(false);
                mock.setConnected(false);
              }}
            >
              Disconnected
            </Chip>
          </Group>
          <Group label="Forecast fetch">
            <Chip
              active={!failing}
              onClick={() => {
                setFailing(false);
                mock.failForecast(false);
              }}
            >
              Works
            </Chip>
            <Chip
              active={failing}
              onClick={() => {
                setFailing(true);
                mock.failForecast(true);
              }}
            >
              Fails
            </Chip>
          </Group>
        </aside>
      )}
    </>
  );
};

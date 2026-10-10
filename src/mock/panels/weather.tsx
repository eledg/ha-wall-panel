import { useState } from 'preact/hooks';

import { config } from '../../config.ts';
import { Chip, Group, useMockChanges } from '../ui.tsx';
import type { MockPanel } from './types.ts';

const id = config.entities.weather.id;

export const weatherPanel: MockPanel = {
  id: 'weather',
  title: 'Weather',
  Panel: ({ mock }) => {
    useMockChanges(mock);
    const [scenario, setScenario] = useState(mock.weatherScenarios[0]?.id);
    const [failing, setFailing] = useState(false);
    return (
      <>
        <p class="mb-3 font-mono text-small text-fg-dim">
          {id}: {mock.getState(id)?.state ?? 'missing'}
        </p>
        <Group label="Scenario">
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
        <Group label="Entity state">
          <Chip onClick={() => mock.setUnavailable(id)}>Unavailable</Chip>
          <Chip onClick={() => mock.removeEntity(id)}>Missing</Chip>
          <Chip onClick={() => scenario && mock.setWeather(scenario)}>
            Restore
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
      </>
    );
  },
};

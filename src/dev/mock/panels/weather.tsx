import { entityId } from '@/config/config.ts';
import { Chip, Group, useMockChanges } from '@/dev/mock/ui.tsx';

import type { MockPanel } from './types.ts';

export const weatherPanel: MockPanel = {
  id: 'weather',
  title: 'Weather',
  Panel: ({ mock }) => {
    useMockChanges(mock);
    const id = entityId('weather');
    const scenario = mock.getWeatherScenario();
    const failing = mock.isForecastFailing();
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
              onClick={() => mock.setWeather(key)}
            >
              {label}
            </Chip>
          ))}
        </Group>
        <Group label="Entity state">
          <Chip onClick={() => mock.setUnavailable(id)}>Unavailable</Chip>
          <Chip onClick={() => mock.removeEntity(id)}>Missing</Chip>
          <Chip onClick={() => mock.setWeather(scenario)}>Restore</Chip>
        </Group>
        <Group label="Forecast fetch">
          <Chip active={!failing} onClick={() => mock.failForecast(false)}>
            Works
          </Chip>
          <Chip active={failing} onClick={() => mock.failForecast(true)}>
            Fails
          </Chip>
        </Group>
      </>
    );
  },
};

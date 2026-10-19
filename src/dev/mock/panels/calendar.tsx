import { entityId } from '@/config/config.ts';
import { Chip, Group, useMockChanges } from '@/dev/mock/ui.tsx';

import type { MockPanel } from './types.ts';

export const calendarPanel: MockPanel = {
  id: 'calendar',
  title: 'Calendar',
  Panel: ({ mock }) => {
    useMockChanges(mock);
    const ids = [
      entityId('calendarFamily'),
      entityId('calendarF1'),
      entityId('calendarBirthdays'),
    ];
    const scenario = mock.getCalendarScenario();
    const failing = mock.isCalendarFailing();
    return (
      <>
        <p class="mb-3 font-mono text-small text-fg-dim">{ids.join(', ')}</p>
        <Group label="Scenario">
          {mock.calendarScenarios.map(({ id, label }) => (
            <Chip
              key={id}
              active={scenario === id}
              onClick={() => mock.setCalendar(id)}
            >
              {label}
            </Chip>
          ))}
        </Group>
        <Group label="Entity state">
          <Chip onClick={() => ids.forEach((id) => mock.setUnavailable(id))}>
            Unavailable
          </Chip>
          <Chip onClick={() => ids.forEach((id) => mock.removeEntity(id))}>
            Missing
          </Chip>
          <Chip onClick={() => mock.setCalendar(scenario)}>Restore</Chip>
        </Group>
        <p class="mb-1 text-small text-fg-dim">
          Fetching only happens on a connect, an entity change or every 5
          minutes, so Fails shows nothing until then. Picking a scenario or
          Restore triggers one: the tile keeps its last events, and shows stale
          once 15 minutes pass without a successful refresh.
        </p>
        <Group label="Event fetch">
          <Chip active={!failing} onClick={() => mock.failCalendar(false)}>
            Works
          </Chip>
          <Chip active={failing} onClick={() => mock.failCalendar(true)}>
            Fails
          </Chip>
        </Group>
      </>
    );
  },
};

import { entityId } from '@/config/config.ts';
import { HEATING_STATES } from '@/dev/mock/scenarios/heating.ts';
import { Chip, Group, useMockChanges } from '@/dev/mock/ui.tsx';

import type { MockPanel } from './types.ts';

const label = (state: string) => state.charAt(0).toUpperCase() + state.slice(1);

export const heatingPanel: MockPanel = {
  id: 'heating',
  title: 'Heating',
  Panel: ({ mock }) => {
    useMockChanges(mock);
    const climate = entityId('heatingClimate');
    const demand = entityId('heatingDemand');
    const cloud = entityId('heatingCloud');
    const state = mock.getState(climate);
    const attrs = state?.attributes ?? {};
    return (
      <>
        <p class="mb-3 font-mono text-small text-fg-dim">
          {climate}: {state?.state ?? 'missing'}
          {state && ` · target ${String(attrs.temperature ?? '–')}°`}
          {` · ${mock.getHeating()}`}
          {` · demand ${mock.getState(demand)?.state ?? '–'}`}
        </p>
        <Group label="HA sets state (power × control)">
          {HEATING_STATES.map((heating) => (
            <Chip
              key={heating}
              active={mock.getHeating() === heating}
              onClick={() => mock.setHeating(heating)}
            >
              {label(heating)}
            </Chip>
          ))}
        </Group>
        <Group label="Boiler demand">
          <Chip
            active={mock.getState(demand)?.state === 'on'}
            onClick={() =>
              mock.setHeatingDemand(mock.getState(demand)?.state !== 'on')
            }
          >
            Demand
          </Chip>
        </Group>
        <Group label="Entities">
          <Chip onClick={() => mock.setUnavailable(climate)}>
            Heating unavailable
          </Chip>
          <Chip
            active={mock.getState(cloud)?.state === 'off'}
            onClick={() =>
              mock.setState(
                cloud,
                mock.getState(cloud)?.state === 'off' ? 'on' : 'off',
              )
            }
          >
            Cloud connection lost
          </Chip>
          <Chip onClick={() => mock.setHeating('schedule')}>
            Heating back (schedule)
          </Chip>
        </Group>
        <Group label="Fetches and calls">
          <Chip onClick={() => mock.failHistory(!mock.isHistoryFailing())}>
            {mock.isHistoryFailing()
              ? 'History fails (tap to fix)'
              : 'Make history fail'}
          </Chip>
          <Chip onClick={() => mock.failServices(!mock.isServicesFailing())}>
            {mock.isServicesFailing()
              ? 'Calls fail (tap to fix)'
              : 'Make calls fail'}
          </Chip>
        </Group>
      </>
    );
  },
};

import { entitiesOf } from '@/dev/mock/entities.ts';
import { Chip, Group, useMockChanges } from '@/dev/mock/ui.tsx';

import type { MockPanel } from './types.ts';

const modes = ['off', 'cool', 'heat', 'fan_only', 'dry', 'auto'];

export const acPanel: MockPanel = {
  id: 'ac',
  title: 'AC',
  Panel: ({ mock }) => {
    useMockChanges(mock);
    const entities = entitiesOf('ac');
    const ac = entities.climate;
    const switches = [
      ['Powerful', entities.powerful],
      ['Economy', entities.economy],
      ['Quiet', entities.quietFan],
    ] as const;
    const state = mock.getState(ac);
    const attrs = state?.attributes ?? {};
    return (
      <>
        <p class="mb-3 font-mono text-small text-fg-dim">
          {ac}: {state?.state ?? 'missing'}
          {state && ` · target ${String(attrs.temperature ?? '–')}°`}
          {state && ` · fan ${String(attrs.fan_mode ?? '–')}`}
          {state && ` · swing ${String(attrs.swing_mode ?? '–')}`}
        </p>
        <Group label="HA sets mode">
          {modes.map((mode) => (
            <Chip
              key={mode}
              active={state?.state === mode}
              onClick={() => mock.setState(ac, mode, attrs)}
            >
              {mode}
            </Chip>
          ))}
        </Group>
        <Group label="Room temperature">
          {[18, 21.4, 26].map((temp) => (
            <Chip
              key={temp}
              active={attrs.current_temperature === temp}
              onClick={() =>
                mock.setState(ac, state?.state ?? 'off', {
                  ...attrs,
                  current_temperature: temp,
                })
              }
            >
              {`${temp}°`}
            </Chip>
          ))}
        </Group>
        <Group label="HA sets a switch">
          {switches.map(([label, id]) => (
            <Chip
              key={id}
              active={mock.getState(id)?.state === 'on'}
              onClick={() =>
                mock.setState(
                  id,
                  mock.getState(id)?.state === 'on' ? 'off' : 'on',
                )
              }
            >
              {label}
            </Chip>
          ))}
        </Group>
        <Group label="Entities">
          <Chip onClick={() => mock.setUnavailable(ac)}>AC unavailable</Chip>
          <Chip onClick={() => mock.setUnavailable(switches[0][1])}>
            Powerful unavailable
          </Chip>
          <Chip onClick={() => mock.setAcOdd(!mock.isAcOdd())}>
            {mock.isAcOdd() ? 'Odd data (tap to fix)' : 'Odd data'}
          </Chip>
          <Chip onClick={() => mock.setState(ac, 'off')}>AC back (off)</Chip>
        </Group>
        <Group label="Service calls">
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

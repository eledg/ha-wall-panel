import { entityId } from '@/config/config.ts';
import { Chip, Group, useMockChanges } from '@/dev/mock/ui.tsx';

import type { MockPanel } from './types.ts';

export const lightPanel: MockPanel = {
  id: 'light',
  title: 'Light',
  Panel: ({ mock }) => {
    useMockChanges(mock);
    const light = entityId('light');
    const on = mock.getState(light)?.state === 'on';
    return (
      <>
        <p class="mb-3 font-mono text-small text-fg-dim">
          {light}: {mock.getState(light)?.state ?? 'missing'}
        </p>
        <Group label="State">
          <Chip onClick={() => mock.setState(light, on ? 'off' : 'on')}>
            HA flips light
          </Chip>
          <Chip onClick={() => mock.setUnavailable(light)}>
            Light unavailable
          </Chip>
          <Chip onClick={() => mock.setState(light, 'off')}>Light back</Chip>
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

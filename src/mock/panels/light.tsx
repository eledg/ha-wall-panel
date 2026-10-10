import { config } from '../../config.ts';
import { Chip, Group, useMockChanges } from '../ui.tsx';
import type { MockPanel } from './types.ts';

const light = config.entities.officeLight.id;

export const lightPanel: MockPanel = {
  id: 'light',
  title: 'Light',
  Panel: ({ mock }) => {
    useMockChanges(mock);
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
      </>
    );
  },
};

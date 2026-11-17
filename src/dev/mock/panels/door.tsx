import { entitiesOf } from '@/dev/mock/entities.ts';
import {
  cameraAttributes,
  DEAD_TOKEN,
  FAILING_TOKEN,
} from '@/dev/mock/scenarios/door.ts';
import { Chip, Group, useMockChanges } from '@/dev/mock/ui.tsx';

import type { MockPanel } from './types.ts';

export const doorPanel: MockPanel = {
  id: 'door',
  title: 'Door',
  Panel: ({ mock }) => {
    useMockChanges(mock);
    const { ring, camera } = entitiesOf('door');
    return (
      <>
        <p class="mb-3 font-mono text-small text-fg-dim">
          {ring}: {mock.getState(ring)?.state ?? 'missing'}
        </p>
        <Group label="Ring doorbell">
          <Chip onClick={() => mock.ring()}>Ring</Chip>
          <Chip onClick={() => mock.ring(true)}>Double fire</Chip>
        </Group>
        <Group label="State">
          <Chip onClick={() => mock.setUnavailable(ring)}>
            Doorbell unavailable
          </Chip>
          <Chip onClick={() => mock.setState(ring, 'unknown')}>
            Doorbell back
          </Chip>
          <Chip onClick={() => mock.setUnavailable(camera)}>
            Camera unavailable
          </Chip>
          <Chip
            onClick={() => mock.setState(camera, 'idle', cameraAttributes())}
          >
            Camera back
          </Chip>
          <Chip
            onClick={() =>
              mock.setState(camera, 'idle', cameraAttributes(FAILING_TOKEN))
            }
          >
            Stream fails
          </Chip>
          <Chip
            onClick={() =>
              mock.setState(camera, 'idle', cameraAttributes(DEAD_TOKEN))
            }
          >
            Stream and snapshot fail
          </Chip>
        </Group>
      </>
    );
  },
};

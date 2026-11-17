import { useState } from 'preact/hooks';

import { applyConfig, getConfig } from '@/config/config.ts';
import { mockConfig } from '@/dev/mock/config.ts';
import { entitiesOf } from '@/dev/mock/entities.ts';
import {
  cameraAttributes,
  DEAD_TOKEN,
  FAILING_TOKEN,
  packageCameraAttributes,
} from '@/dev/mock/scenarios/door.ts';
import { Chip, Group, useMockChanges } from '@/dev/mock/ui.tsx';

import type { MockPanel } from './types.ts';

/** The fixture's package camera, which the chips act on even while the role is off. */
const packageCamera = mockConfig.tiles.find((t) => t.type === 'door')?.entities
  .packageCamera as string;

const hasPackageRole = () =>
  getConfig().tiles.some(
    (t) => t.type === 'door' && t.entities.packageCamera !== undefined,
  );

/**
 * Takes the package camera role off the door tile, or puts it back, as if
 * `config.json` had changed: the overlay reads the config on the next ring.
 */
const togglePackageRole = () => {
  const off = hasPackageRole();
  applyConfig({
    ...getConfig(),
    tiles: getConfig().tiles.map((t) => {
      if (t.type !== 'door') return t;
      const { packageCamera: _, ...entities } = t.entities;
      return {
        ...t,
        entities: off ? entities : { ...entities, packageCamera },
      };
    }),
  });
};

export const doorPanel: MockPanel = {
  id: 'door',
  title: 'Door',
  Panel: ({ mock }) => {
    useMockChanges(mock);
    const { ring, camera } = entitiesOf('door');
    const [roleOn, setRoleOn] = useState(hasPackageRole);
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
        <Group label="Package camera">
          <Chip
            active={!roleOn}
            onClick={() => {
              togglePackageRole();
              setRoleOn(hasPackageRole());
            }}
          >
            No package camera
          </Chip>
          <Chip onClick={() => mock.setUnavailable(packageCamera)}>
            Package unavailable
          </Chip>
          <Chip
            onClick={() =>
              mock.setState(packageCamera, 'idle', packageCameraAttributes())
            }
          >
            Package back
          </Chip>
          <Chip
            onClick={() =>
              mock.setState(
                packageCamera,
                'idle',
                packageCameraAttributes(DEAD_TOKEN),
              )
            }
          >
            Package snapshot fails
          </Chip>
        </Group>
        <Group label="WebRTC">
          {mock.webRtcModes.map(({ id, label }) => (
            <Chip
              key={id}
              active={mock.getWebRtc() === id}
              onClick={() => mock.setWebRtc(id)}
            >
              {label}
            </Chip>
          ))}
        </Group>
      </>
    );
  },
};

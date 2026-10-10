import { useState } from 'preact/hooks';

import { Chip, Group } from '../ui.tsx';
import type { MockPanel } from './types.ts';

export const connectionPanel: MockPanel = {
  id: 'connection',
  title: 'Home Assistant',
  Panel: ({ mock }) => {
    const [connected, setConnected] = useState(true);
    const set = (value: boolean) => {
      setConnected(value);
      mock.setConnected(value);
    };
    return (
      <Group label="Connection">
        <Chip active={connected} onClick={() => set(true)}>
          Connected
        </Chip>
        <Chip active={!connected} onClick={() => set(false)}>
          Disconnected
        </Chip>
      </Group>
    );
  },
};

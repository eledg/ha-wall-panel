import { Chip, Group, useMockChanges } from '../ui.tsx';
import type { MockPanel } from './types.ts';

export const connectionPanel: MockPanel = {
  id: 'connection',
  title: 'Home Assistant',
  Panel: ({ mock }) => {
    useMockChanges(mock);
    const connected = mock.isConnected();
    const set = mock.setConnected;
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

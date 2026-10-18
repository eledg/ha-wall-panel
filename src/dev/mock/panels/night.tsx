import { useEffect, useState } from 'preact/hooks';

import { Chip, Group } from '@/dev/mock/ui.tsx';
import {
  getNightMode,
  type NightMode,
  setNightMode,
  subscribeNightMode,
} from '@/lib/night.ts';

import type { MockPanel } from './types.ts';

const MODES: { id: NightMode; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'on', label: 'Night' },
  { id: 'off', label: 'Day' },
];

export const nightPanel: MockPanel = {
  id: 'night',
  title: 'Night mode',
  Panel: () => {
    const [, setTick] = useState(0);
    useEffect(() => subscribeNightMode(() => setTick((n) => n + 1)), []);
    const current = getNightMode();
    return (
      <Group label="Mode">
        {MODES.map(({ id, label }) => (
          <Chip
            key={id}
            active={current === id}
            onClick={() => setNightMode(id)}
          >
            {label}
          </Chip>
        ))}
      </Group>
    );
  },
};

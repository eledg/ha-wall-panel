import { useEffect, useState } from 'preact/hooks';

import { getConfig } from '@/config/config.ts';
import { Chip, Group, useMockChanges } from '@/dev/mock/ui.tsx';
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
  Panel: ({ mock }) => {
    const [, setTick] = useState(0);
    useEffect(() => subscribeNightMode(() => setTick((n) => n + 1)), []);
    useMockChanges(mock);
    const current = getNightMode();
    const sw = getConfig().night.overrideSwitch;
    return (
      <>
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
        {sw && (
          <>
            <p class="mb-3 font-mono text-small text-fg-dim">
              {sw}: {mock.getState(sw)?.state ?? 'missing'}
            </p>
            <Group label="Override switch (Auto mode)">
              <Chip onClick={() => mock.setState(sw, 'on')}>Switch on</Chip>
              <Chip onClick={() => mock.setState(sw, 'off')}>Switch off</Chip>
              <Chip onClick={() => mock.setUnavailable(sw)}>
                Switch unavailable
              </Chip>
            </Group>
          </>
        )}
      </>
    );
  },
};

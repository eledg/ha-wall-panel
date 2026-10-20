import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';

import { FlameIcon } from '@/components/icons/flame-icon.tsx';
import { HeatWavesIcon } from '@/components/icons/heat-waves-icon.tsx';
import { PauseIcon } from '@/components/icons/pause-icon.tsx';
import { HeatingSheet } from '@/components/sheets/heating-sheet.tsx';
import type { TileConfig } from '@/config/config.ts';
import { useSnapshot } from '@/hooks/use-snapshot.ts';
import { type HeatingState, readHeating } from '@/lib/climate/heating-model.ts';
import { formatTemp } from '@/lib/format.ts';
import { haStore } from '@/services/ha/instance.ts';
import type { HaStore } from '@/services/ha/store.ts';

import {
  DeviceTile,
  type DeviceTone,
  MissingValue,
  Temperature,
} from './base/device-tile.tsx';
import { tileState } from './base/tile.tsx';

const TONE: Record<HeatingState, DeviceTone> = {
  schedule: 'accent',
  manual: 'manual',
  off: 'neutral',
  paused: 'neutral',
};

const STATE_LABEL: Record<HeatingState, string> = {
  schedule: 'Schedule',
  manual: 'Manual',
  off: 'Off',
  paused: 'Paused',
};

/**
 * Central heating (whole house), as in the design: the target while heating is
 * on, "Off" when not, the state (Schedule, Manual, Off or Paused) as the tile's
 * colour and status line, and a heat-waves icon that follows boiler demand alone. Tapping opens the `HeatingSheet`.
 */
export const HeatingTile = ({
  tile,
  store = haStore,
}: {
  tile: TileConfig<'heating'>;
  store?: HaStore;
}) => {
  const climate = useSnapshot(store, (s) => s.entities[tile.entities.climate]);
  const schedule = useSnapshot(
    store,
    (s) => s.entities[tile.entities.schedule],
  );
  const demand = useSnapshot(store, (s) => s.entities[tile.entities.demand]);
  const cloud = useSnapshot(store, (s) => s.entities[tile.entities.cloud]);
  const [open, setOpen] = useState(false);
  const view = readHeating(climate, schedule, demand, cloud);
  const state = tileState([climate, schedule], view.usable);
  const running = view.state === 'schedule' || view.state === 'manual';

  let status: ComponentChildren;
  if (view.state === 'paused') {
    status = (
      <span class="flex items-center gap-1 text-xs">
        <PauseIcon class="size-3" />
        {STATE_LABEL.paused}
      </span>
    );
  } else if (running) {
    status = <span class="text-xs">{STATE_LABEL[view.state]}</span>;
  }

  let value: ComponentChildren = <div class="text-4xl font-semibold">Off</div>;
  if (running) {
    value =
      view.target === undefined ? (
        <MissingValue />
      ) : (
        <Temperature value={formatTemp(view.target)} matchDegree />
      );
  }

  return (
    <>
      <DeviceTile
        place={tile}
        state={state}
        onTap={state === 'unavailable' ? undefined : () => setOpen(true)}
        tone={TONE[view.state]}
        icon={<FlameIcon class="size-4" />}
        label={tile.label}
        right={<HeatWavesIcon demand={view.demand} class="size-5" />}
        status={status}
        value={value}
      />
      {open && (
        <HeatingSheet
          tile={tile}
          store={store}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

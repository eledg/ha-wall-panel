import { useState } from 'preact/hooks';

import { type HeatingState, readHeating } from './heating-model.ts';
import { HeatingSheet } from './heating-sheet.tsx';
import type { GridArea } from '../../grid.ts';
import { haStore } from '../../ha/instance.ts';
import type { HaStore } from '../../ha/store.ts';
import { useSnapshot } from '../../ha/use-snapshot.ts';
import { FlameIcon } from '../../icons/flame-icon.tsx';
import { HeatWavesIcon } from '../../icons/heat-waves-icon.tsx';
import { PauseIcon } from '../../icons/pause-icon.tsx';
import {
  DeviceTile,
  type DeviceTone,
  MissingValue,
  Temperature,
} from '../device-tile.tsx';
import { formatTemp } from '../temp/temp-model.ts';
import { tileState } from '../tile.tsx';

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
  area,
  store = haStore,
}: {
  area: GridArea;
  store?: HaStore;
}) => {
  const climate = useSnapshot(store, (s) => s.entities.heatingClimate);
  const schedule = useSnapshot(store, (s) => s.entities.heatingSchedule);
  const demand = useSnapshot(store, (s) => s.entities.heatingDemand);
  const cloud = useSnapshot(store, (s) => s.entities.heatingCloud);
  const [open, setOpen] = useState(false);
  const view = readHeating(climate, schedule, demand, cloud);
  const state = tileState([climate, schedule], view.usable);
  const running = view.state === 'schedule' || view.state === 'manual';

  return (
    <>
      <DeviceTile
        area={area}
        state={state}
        onTap={state === 'unavailable' ? undefined : () => setOpen(true)}
        tone={TONE[view.state]}
        icon={<FlameIcon class="size-4" />}
        label="Heating"
        right={<HeatWavesIcon demand={view.demand} class="size-5" />}
        status={
          view.state === 'paused' ? (
            <span class="flex items-center gap-1 text-xs">
              <PauseIcon class="size-3" />
              {STATE_LABEL.paused}
            </span>
          ) : running ? (
            <span class="text-xs">{STATE_LABEL[view.state]}</span>
          ) : undefined
        }
        value={
          running ? (
            view.target === undefined ? (
              <MissingValue />
            ) : (
              <Temperature value={formatTemp(view.target)} matchDegree />
            )
          ) : (
            <div class="text-4xl font-semibold">Off</div>
          )
        }
      />
      {open && <HeatingSheet store={store} onClose={() => setOpen(false)} />}
    </>
  );
};

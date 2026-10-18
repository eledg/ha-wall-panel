import { useState } from 'preact/hooks';

import { ModeIcon } from '@/components/climate/ac-controls.tsx';
import { SnowflakeIcon } from '@/components/icons/snowflake-icon.tsx';
import { AcSheet } from '@/components/sheets/ac-sheet.tsx';
import { useSnapshot } from '@/hooks/use-snapshot.ts';
import { modeLabel, readAc } from '@/lib/climate/ac-model.ts';
import { formatTemp } from '@/lib/format.ts';
import type { GridArea } from '@/lib/grid.ts';
import { haStore } from '@/services/ha/instance.ts';
import type { HaStore } from '@/services/ha/store.ts';

import { DeviceTile, Temperature } from './base/device-tile.tsx';
import { tileState } from './base/tile.tsx';

/**
 * The office AC: the target temperature and mode when on, "Off" when not.
 * Tapping opens the `AcSheet` with every control.
 */
export const AcTile = ({
  area,
  store = haStore,
}: {
  area: GridArea;
  store?: HaStore;
}) => {
  const entity = useSnapshot(store, (s) => s.entities.acClimate);
  const [open, setOpen] = useState(false);
  const view = readAc(entity);
  const state = tileState([entity], view.usable);

  return (
    <>
      <DeviceTile
        area={area}
        state={state}
        onTap={state === 'unavailable' ? undefined : () => setOpen(true)}
        tone={view.on ? 'accent' : 'neutral'}
        icon={<SnowflakeIcon class="size-4" />}
        label="AC"
        right={
          view.on && view.mode ? (
            <span
              role="img"
              aria-label={modeLabel(view.mode)}
              title={modeLabel(view.mode)}
              class="inline-grid place-items-center"
            >
              <ModeIcon mode={view.mode} small />
            </span>
          ) : undefined
        }
        value={
          view.on && view.target !== undefined ? (
            <Temperature value={formatTemp(view.target)} matchDegree />
          ) : (
            <div class="tnum text-4xl font-semibold">
              {view.on ? 'On' : 'Off'}
            </div>
          )
        }
      />
      {open && <AcSheet store={store} onClose={() => setOpen(false)} />}
    </>
  );
};

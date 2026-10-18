import { useState } from 'preact/hooks';

import { ModeIcon } from './ac-controls.tsx';
import { modeLabel, readAc } from './ac-model.ts';
import { AcSheet } from './ac-sheet.tsx';
import type { GridArea } from '../../grid.ts';
import { haStore } from '../../ha/instance.ts';
import type { HaStore } from '../../ha/store.ts';
import { useSnapshot } from '../../ha/use-snapshot.ts';
import { SnowflakeIcon } from '../../icons/snowflake-icon.tsx';
import { DeviceTile, Temperature } from '../device-tile.tsx';
import { formatTemp } from '../temp/temp-model.ts';

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
  const unavailable = entity !== undefined && !view.usable;

  return (
    <>
      <DeviceTile
        area={area}
        state={
          entity === undefined
            ? 'loading'
            : unavailable
              ? 'unavailable'
              : undefined
        }
        onTap={unavailable ? undefined : () => setOpen(true)}
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

import { useState } from 'preact/hooks';

import { modeLabel, readAc } from './ac-model.ts';
import { AcSheet } from './ac-sheet.tsx';
import type { GridArea } from '../../grid.ts';
import { useOffline } from '../../ha/connection.tsx';
import { haStore } from '../../ha/instance.ts';
import type { HaStore } from '../../ha/store.ts';
import { useSnapshot } from '../../ha/use-snapshot.ts';
import { SnowflakeIcon } from '../../icons/snowflake-icon.tsx';
import { Tile, Unavailable } from '../tile.tsx';

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
  const offline = useOffline();
  const [open, setOpen] = useState(false);
  const view = readAc(entity);
  const unavailable = entity !== undefined && !view.usable;
  const lit = view.on && !offline;

  return (
    <>
      <Tile
        area={area}
        state={entity === undefined ? 'loading' : offline ? 'stale' : 'normal'}
        onTap={unavailable ? undefined : () => setOpen(true)}
        class={lit ? 'border-accent!' : ''}
      >
        <div class="flex h-full flex-col justify-between">
          <div
            class={`flex items-center gap-1.5 text-sm ${view.on ? 'text-accent' : 'text-fg-dim'}`}
          >
            <SnowflakeIcon class="size-4" />
            AC
          </div>
          {unavailable ? (
            <Unavailable />
          ) : (
            <div>
              <div class="tnum text-3xl font-semibold">
                {view.on && view.target !== undefined
                  ? `${view.target}°`
                  : view.on
                    ? 'On'
                    : 'Off'}
              </div>
              <div class="h-5 text-sm text-fg-dim">
                {view.on ? view.mode && modeLabel(view.mode) : 'Tap to control'}
              </div>
            </div>
          )}
        </div>
      </Tile>
      {open && <AcSheet store={store} onClose={() => setOpen(false)} />}
    </>
  );
};

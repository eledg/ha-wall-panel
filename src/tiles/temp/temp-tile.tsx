import { formatTemp, readTemp } from './temp-model.ts';
import { config } from '../../config.ts';
import type { GridArea } from '../../grid.ts';
import { haStore } from '../../ha/instance.ts';
import type { HaStore } from '../../ha/store.ts';
import { useSnapshot } from '../../ha/use-snapshot.ts';
import { ThermoIcon } from '../../icons/thermo-icon.tsx';
import { Tile } from '../tile.tsx';

const source = config.temperature;

/** The office temperature, read from whichever entity `config.temperature` names. */
export const TempTile = ({
  area,
  store = haStore,
}: {
  area: GridArea;
  store?: HaStore;
}) => {
  const entity = useSnapshot(store, (s) => s.entities[source.entity]);
  const { value } = readTemp(
    entity,
    'attribute' in source ? source.attribute : undefined,
  );

  return (
    <Tile area={area} state={entity === undefined ? 'loading' : 'normal'}>
      <div class="flex h-full flex-col justify-between">
        <div class="flex items-center gap-1.5 text-sm text-fg-dim">
          <ThermoIcon class="size-4" />
          Office
        </div>
        {value === undefined ? (
          <div class="tnum text-4xl font-semibold text-fg-faint">
            —<span class="ml-1 text-sm text-warn">n/a</span>
          </div>
        ) : (
          <div class="tnum text-4xl font-semibold">
            {formatTemp(value)}
            <span class="relative -top-[11.5px] ml-[2px] text-xl text-fg-dim">
              °
            </span>
          </div>
        )}
      </div>
    </Tile>
  );
};

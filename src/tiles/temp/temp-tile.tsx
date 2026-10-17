import { formatHumidity, formatTemp, readTemp } from './temp-model.ts';
import type { GridArea } from '../../grid.ts';
import { haStore } from '../../ha/instance.ts';
import type { HaStore } from '../../ha/store.ts';
import { useSnapshot } from '../../ha/use-snapshot.ts';
import { DropletIcon } from '../../icons/droplet-icon.tsx';
import { ThermoIcon } from '../../icons/thermo-icon.tsx';
import { Tile } from '../tile.tsx';

/** The office temperature and humidity, from the Shelly BLU H&T sensor. */
export const TempTile = ({
  area,
  store = haStore,
}: {
  area: GridArea;
  store?: HaStore;
}) => {
  const tempEntity = useSnapshot(store, (s) => s.entities.officeTemperature);
  const humidityEntity = useSnapshot(store, (s) => s.entities.officeHumidity);
  const { value } = readTemp(tempEntity);
  const { value: percent } = readTemp(humidityEntity);

  return (
    <Tile area={area} state={tempEntity === undefined ? 'loading' : 'normal'}>
      <div class="flex h-full flex-col justify-between">
        <div class="flex items-center gap-1.5 text-sm text-fg-dim">
          <ThermoIcon class="size-4" />
          Office
        </div>
        <div class="flex flex-col items-start gap-1">
          <span
            class="tnum flex items-center gap-0.5 text-xs text-fg-dim"
            aria-label="Office humidity"
          >
            <DropletIcon class="size-3" />
            {percent === undefined ? '—' : formatHumidity(percent)}
          </span>
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
      </div>
    </Tile>
  );
};

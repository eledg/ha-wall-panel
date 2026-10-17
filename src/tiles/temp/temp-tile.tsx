import { DeviceTile, Temperature } from '../device-tile.tsx';
import { formatHumidity, formatTemp, readTemp } from './temp-model.ts';
import type { GridArea } from '../../grid.ts';
import { haStore } from '../../ha/instance.ts';
import type { HaStore } from '../../ha/store.ts';
import { useSnapshot } from '../../ha/use-snapshot.ts';
import { DropletIcon } from '../../icons/droplet-icon.tsx';
import { ThermoIcon } from '../../icons/thermo-icon.tsx';

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
    <DeviceTile
      area={area}
      state={tempEntity === undefined ? 'loading' : 'normal'}
      icon={<ThermoIcon class="size-4" />}
      label="Office"
      status={
        <span
          class="tnum flex items-center gap-0.5 text-xs text-fg-dim"
          aria-label="Office humidity"
        >
          <DropletIcon class="size-3" />
          {percent === undefined ? '—' : formatHumidity(percent)}
        </span>
      }
      value={
        value === undefined ? (
          <div class="tnum text-4xl font-semibold text-fg-faint">
            —<span class="ml-1 text-sm text-warn">n/a</span>
          </div>
        ) : (
          <Temperature value={formatTemp(value)} />
        )
      }
    />
  );
};

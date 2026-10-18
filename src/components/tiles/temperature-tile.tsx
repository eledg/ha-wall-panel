import { DropletIcon } from '@/components/icons/droplet-icon.tsx';
import { ThermoIcon } from '@/components/icons/thermo-icon.tsx';
import { useSnapshot } from '@/hooks/use-snapshot.ts';
import { readTemperature } from '@/lib/climate/temperature-model.ts';
import { formatHumidity, formatTemp } from '@/lib/format.ts';
import type { GridArea } from '@/lib/grid.ts';
import { haStore } from '@/services/ha/instance.ts';
import type { HaStore } from '@/services/ha/store.ts';

import { DeviceTile, MissingValue, Temperature } from './base/device-tile.tsx';
import { tileState } from './base/tile.tsx';

/** The office temperature and humidity, from the Shelly BLU H&T sensor. */
export const TemperatureTile = ({
  area,
  store = haStore,
}: {
  area: GridArea;
  store?: HaStore;
}) => {
  const temperatureEntity = useSnapshot(
    store,
    (s) => s.entities.officeTemperature,
  );
  const humidityEntity = useSnapshot(store, (s) => s.entities.officeHumidity);
  const { value } = readTemperature(temperatureEntity);
  const { value: percent } = readTemperature(humidityEntity);

  return (
    <DeviceTile
      area={area}
      state={tileState([temperatureEntity])}
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
          <MissingValue />
        ) : (
          <Temperature value={formatTemp(value)} />
        )
      }
    />
  );
};

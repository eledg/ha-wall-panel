import { DropletIcon } from '@/components/icons/droplet-icon.tsx';
import { ThermoIcon } from '@/components/icons/thermo-icon.tsx';
import type { TileConfig } from '@/config/config.ts';
import { useSnapshot } from '@/hooks/use-snapshot.ts';
import { readTemperature } from '@/lib/climate/temperature-model.ts';
import { formatHumidity, formatTemp } from '@/lib/format.ts';
import { haStore } from '@/services/ha/instance.ts';
import type { HaStore } from '@/services/ha/store.ts';

import { DeviceTile, MissingValue, Temperature } from './base/device-tile.tsx';
import { tileState } from './base/tile.tsx';

/** The room temperature and humidity, from one sensor. */
export const TemperatureTile = ({
  tile,
  store = haStore,
}: {
  tile: TileConfig<'temperature'>;
  store?: HaStore;
}) => {
  const temperatureEntity = useSnapshot(
    store,
    (s) => s.entities[tile.entities.temperature],
  );
  const humidityEntity = useSnapshot(
    store,
    (s) => s.entities[tile.entities.humidity],
  );
  const { value } = readTemperature(temperatureEntity);
  const { value: percent } = readTemperature(humidityEntity);

  return (
    <DeviceTile
      place={tile}
      state={tileState([temperatureEntity])}
      icon={<ThermoIcon class="size-4" />}
      label={tile.label}
      status={
        <span
          class="tnum flex items-center gap-0.5 text-xs text-fg-dim"
          aria-label={`${tile.label} humidity`}
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

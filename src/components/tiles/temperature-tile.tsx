import { useState } from 'preact/hooks';

import { DropletIcon } from '@/components/icons/droplet-icon.tsx';
import { ThermoIcon } from '@/components/icons/thermo-icon.tsx';
import { AcSheet } from '@/components/sheets/ac-sheet.tsx';
import { HeatingSheet } from '@/components/sheets/heating-sheet.tsx';
import { RoomSheet } from '@/components/sheets/room-sheet.tsx';
import { firstTile } from '@/config/config.ts';
import type { TileConfig } from '@/config/config.ts';
import { useSnapshot } from '@/hooks/use-snapshot.ts';
import { readTemperature } from '@/lib/climate/temperature-model.ts';
import { formatHumidity, formatTemp } from '@/lib/format.ts';
import { haStore } from '@/services/ha/instance.ts';
import type { HaStore } from '@/services/ha/store.ts';

import { DeviceTile, MissingValue, Temperature } from './base/device-tile.tsx';
import { tileState } from './base/tile.tsx';

type Panel = 'climate' | 'heating' | 'ac';

/**
 * The room temperature and humidity, from one sensor. Tapping opens the
 * `RoomSheet`, which links on to the heating and AC sheets of the panel's own
 * heating and AC tiles, if it has them.
 */
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
  const [panel, setPanel] = useState<Panel>();
  const heatingTile = firstTile('heating');
  const acTile = firstTile('ac');
  const close = () => setPanel(undefined);
  const { value } = readTemperature(temperatureEntity);
  const { value: percent } = readTemperature(humidityEntity);

  const state = tileState([temperatureEntity]);

  return (
    <>
      <DeviceTile
        place={tile}
        state={state}
        onTap={state === 'loading' ? undefined : () => setPanel('climate')}
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
      {panel === 'climate' && (
        <RoomSheet
          tile={tile}
          heatingTile={heatingTile}
          acTile={acTile}
          store={store}
          onClose={close}
          onOpenHeating={heatingTile && (() => setPanel('heating'))}
          onOpenAc={acTile && (() => setPanel('ac'))}
        />
      )}
      {panel === 'heating' && heatingTile && (
        <HeatingSheet tile={heatingTile} store={store} onClose={close} />
      )}
      {panel === 'ac' && acTile && (
        <AcSheet tile={acTile} store={store} onClose={close} />
      )}
    </>
  );
};

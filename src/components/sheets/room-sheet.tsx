import {
  ClimateButton,
  ClimateSheet,
} from '@/components/climate/climate-controls.tsx';
import { HISTORY_HOURS } from '@/components/climate/heating-history.tsx';
import { RoomChart } from '@/components/climate/room-chart.tsx';
import { DropletIcon } from '@/components/icons/droplet-icon.tsx';
import { FlameIcon } from '@/components/icons/flame-icon.tsx';
import { SnowflakeIcon } from '@/components/icons/snowflake-icon.tsx';
import { Temperature } from '@/components/tiles/base/device-tile.tsx';
import type { TileConfig } from '@/config/config.ts';
import { IDLE_CLOSE_MS } from '@/config/constants.ts';
import { useIdleClose } from '@/hooks/use-idle-close.ts';
import { useOffline } from '@/hooks/use-offline.ts';
import { useRoomHistory } from '@/hooks/use-room-history.ts';
import { useSnapshot } from '@/hooks/use-snapshot.ts';
import { readAc } from '@/lib/climate/ac-model.ts';
import { readHeating } from '@/lib/climate/heating-model.ts';
import {
  acLine,
  comfort,
  extent,
  heatingLine,
  roomStatus,
} from '@/lib/climate/room-model.ts';
import { readTemperature } from '@/lib/climate/temperature-model.ts';
import { formatHumidity, formatTemp } from '@/lib/format.ts';
import { haStore } from '@/services/ha/instance.ts';
import type { HaStore } from '@/services/ha/store.ts';

export { HISTORY_REFRESH_MS } from '@/hooks/use-room-history.ts';

/**
 * Full-screen room climate, as in the design: the temperature and humidity now
 * with how the room feels, shortcuts to the heating and AC sheets when the
 * panel has those tiles, and the last six hours of temperature and humidity
 * with the stretches the heating and AC ran shaded behind. The history is read
 * from HA on open and refreshed while the sheet stays open; a failed refresh
 * keeps what is on screen.
 */
export const RoomSheet = ({
  tile,
  heatingTile,
  acTile,
  onClose,
  onOpenHeating,
  onOpenAc,
  store = haStore,
  idleMs = IDLE_CLOSE_MS,
}: {
  tile: TileConfig<'temperature'>;
  /** The panel's heating tile, if it has one. */
  heatingTile?: TileConfig<'heating'>;
  /** The panel's AC tile, if it has one. */
  acTile?: TileConfig<'ac'>;
  onClose: () => void;
  onOpenHeating?: () => void;
  onOpenAc?: () => void;
  store?: HaStore;
  idleMs?: number;
}) => {
  const { temperature: temperatureId, humidity: humidityId } = tile.entities;
  const heatingIds = heatingTile?.entities;
  const acId = acTile?.entities.climate;
  const [temperatureEntity, humidityEntity, ...rest] = useSnapshot(
    store,
    (s) =>
      [
        s.entities[temperatureId],
        s.entities[humidityId],
        s.entities[heatingIds?.climate ?? ''],
        s.entities[heatingIds?.schedule ?? ''],
        s.entities[heatingIds?.demand ?? ''],
        s.entities[heatingIds?.cloud ?? ''],
        s.entities[heatingIds?.power ?? ''],
        s.entities[acId ?? ''],
      ] as const,
  );
  const [climate, schedule, demand, cloud, power, acEntity] = rest;
  const offline = useOffline();
  const onActivity = useIdleClose(onClose, idleMs);
  const history = useRoomHistory(store, HISTORY_HOURS, {
    temperature: temperatureId,
    humidity: humidityId,
    demand: heatingIds?.demand,
    ac: acId,
  });

  const { value: temperature } = readTemperature(temperatureEntity);
  const { value: humidity } = readTemperature(humidityEntity);
  const heating = heatingTile
    ? readHeating(climate, schedule, demand, cloud, power)
    : undefined;
  const ac = acTile ? readAc(acEntity) : undefined;
  const heatingLinked = heating?.usable === true;
  const acLinked = ac?.usable === true;

  const feel = comfort(temperature, humidity);
  const tempRange = extent(history?.temps);
  const humidityRange = extent(history?.humidity);

  const status = roomStatus(tile.label, temperature, humidity, feel, offline);

  return (
    <ClimateSheet
      title={`${tile.label} climate`}
      titleId="room-title"
      status={status}
      warning={temperature === undefined || feel.warn}
      onClose={onClose}
      onActivity={onActivity}
    >
      <div
        class={`grid min-h-0 flex-1 grid-cols-1 gap-4 min-[700px]:grid-cols-[minmax(0,260px)_minmax(0,1fr)] ${
          offline ? 'opacity-60' : ''
        }`}
      >
        <div class="flex min-w-0 flex-col gap-2">
          <div class="rounded-xl border border-line bg-surface-2 p-3">
            <div class="text-xs text-fg-dim">{tile.label} now</div>
            <div class="mt-1 flex items-end gap-4">
              {temperature === undefined ? (
                <span class="text-4xl font-semibold text-fg-faint">—</span>
              ) : (
                <Temperature value={formatTemp(temperature)} />
              )}
              <span class="tnum flex items-center gap-1 pb-1 text-xl text-humidity">
                <DropletIcon class="size-5" />
                {humidity === undefined ? '—' : formatHumidity(humidity)}
              </span>
            </div>
            <div class={`mt-2 text-sm ${feel.warn ? 'text-warn' : 'text-ok'}`}>
              {feel.label}
            </div>
            {tempRange && (
              <div class="tnum mt-2 border-t border-line pt-2 text-xs text-fg-dim">
                {HISTORY_HOURS}h: {formatTemp(tempRange.min)}°–
                {formatTemp(tempRange.max)}°
                {humidityRange &&
                  ` · ${Math.round(humidityRange.min)}–${formatHumidity(humidityRange.max)}`}
              </div>
            )}
          </div>
          {heating && heatingLinked && onOpenHeating && (
            <ClimateButton
              class="flex items-center gap-3 px-3 text-left"
              onClick={onOpenHeating}
            >
              <FlameIcon class="size-5 shrink-0 text-accent" />
              <span class="min-w-0">
                <span class="block text-xs text-fg-dim">Central heating</span>
                <span class="tnum block truncate text-sm">
                  {heatingLine(heating)}
                </span>
              </span>
            </ClimateButton>
          )}
          {ac && acLinked && onOpenAc && (
            <ClimateButton
              class="flex items-center gap-3 px-3 text-left"
              onClick={onOpenAc}
            >
              <SnowflakeIcon class="size-5 shrink-0 text-cool" />
              <span class="min-w-0">
                <span class="block text-xs text-fg-dim">{acTile?.label}</span>
                <span class="tnum block truncate text-sm">{acLine(ac)}</span>
              </span>
            </ClimateButton>
          )}
        </div>
        <RoomChart
          temps={history?.temps}
          humidity={history?.humidity}
          heating={
            heatingLinked && history?.heating
              ? {
                  intervals: history.heating,
                  target: heating?.on ? heating.target : undefined,
                }
              : undefined
          }
          ac={
            acLinked && history?.ac
              ? {
                  intervals: history.ac,
                  target: ac?.on ? ac.target : undefined,
                }
              : undefined
          }
          start={history?.start}
          end={history?.end}
        />
      </div>
    </ClimateSheet>
  );
};

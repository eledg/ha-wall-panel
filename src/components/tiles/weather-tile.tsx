import { useState } from 'preact/hooks';

import { DropletIcon } from '@/components/icons/droplet-icon.tsx';
import { WeatherAlertBadge } from '@/components/icons/weather-alert-badge.tsx';
import { WeatherIcon } from '@/components/icons/weather-icon.tsx';
import { WeatherSheet } from '@/components/sheets/weather-sheet.tsx';
import type { TileConfig } from '@/config/config.ts';
import { useSnapshot } from '@/hooks/use-snapshot.ts';
import {
  readWeatherAlerts,
  relevantWeatherAlerts,
} from '@/lib/weather-alerts.ts';
import {
  currentPeriod,
  degrees,
  describe,
  hour,
  metricValue,
  pickForecast,
  uvIndex,
} from '@/lib/weather-model.ts';
import { haStore } from '@/services/ha/instance.ts';
import type { HaStore } from '@/services/ha/store.ts';

import { Tile, Unavailable } from './base/tile.tsx';
import type { TileState } from './base/tile.tsx';

/**
 * Current conditions and a short forecast. While HA is unreachable it keeps
 * showing the last known state, dimmed and badged stale. Tapping opens the
 * `WeatherSheet` once there is something to show.
 */
export const WeatherTile = ({
  tile,
  store = haStore,
  now = () => new Date(),
}: {
  tile: TileConfig<'weather'>;
  store?: HaStore;
  now?: () => Date;
}) => {
  const id = tile.entities.entity;
  const [open, setOpen] = useState(false);
  const alertsId = tile.entities.alerts;
  const [status, subscribed, entity, forecast, alertsEntity] = useSnapshot(
    store,
    (s) =>
      [
        s.status,
        s.subscribed,
        s.entities[id],
        s.forecasts[id],
        alertsId ? s.entities[alertsId] : undefined,
      ] as const,
  );
  const usable =
    entity !== undefined &&
    entity.state !== 'unavailable' &&
    entity.state !== 'unknown';
  const offline = status !== 'connected';
  const misconfigured = subscribed.length > 0 && !entity && status !== 'idle';

  let state: TileState = 'normal'; // Tile turns it stale while offline
  if (!entity && !offline) state = 'unavailable';
  else if (!entity) state = 'loading';
  else if (!usable) state = 'unavailable';

  if (state === 'loading') return <Tile place={tile} state="loading" />;
  if (!usable || !entity) {
    return (
      <Tile place={tile} state="unavailable">
        <div class="flex h-full flex-col justify-center gap-1">
          <Unavailable label="Weather unavailable" />
          <div class="text-sm text-fg-dim">
            {misconfigured ? 'Check entity config' : 'Will retry automatically'}
          </div>
        </div>
      </Tile>
    );
  }

  const [icon, label] = describe(entity.state);
  const at = now();
  const alerts = relevantWeatherAlerts(readWeatherAlerts(alertsEntity), at);
  const periods = pickForecast(forecast ?? [], at);
  const metric = tile.metric;
  const nowPeriod = currentPeriod(forecast ?? [], at);
  const metricNow =
    metric === 'uv'
      ? uvIndex(nowPeriod?.uv_index ?? entity.attributes.uv_index)
      : metricValue(metric, nowPeriod);
  const metricIcon = (cls: string) =>
    metric === 'uv' ? (
      <WeatherIcon condition="sunny" class={cls} />
    ) : (
      <DropletIcon class={cls} />
    );
  return (
    <>
      <Tile place={tile} state={state} onTap={() => setOpen(true)}>
        <div class="flex h-full items-center gap-4">
          <div class="flex shrink-0 items-center gap-3">
            <WeatherIcon condition={icon} class="size-16 text-fg" />
            <div>
              <div class="flex items-start justify-between gap-1">
                <div class="tnum text-5xl leading-none font-semibold">
                  {degrees(entity.attributes.temperature)}
                </div>
                <WeatherAlertBadge alerts={alerts} />
              </div>
              <div class="mt-1 w-28 truncate text-sm text-fg-dim">{label}</div>
              <div class="mt-1 flex items-center gap-1 text-sm text-fg-dim">
                {metricIcon('size-3.5')}
                <span class="tnum">{metricNow}</span>
              </div>
            </div>
          </div>
          <div class="grid min-w-0 flex-1 grid-cols-[auto_repeat(5,minmax(0,1fr))] items-center gap-x-1.5 gap-y-1 border-l border-line pl-3">
            <span aria-hidden="true" />
            {periods.map((period) => (
              <span
                key={period.datetime}
                class="tnum text-center text-xs text-fg-dim"
              >
                {hour(period.datetime)}
              </span>
            ))}
            <span aria-hidden="true" />
            {periods.map((period) => (
              <WeatherIcon
                key={period.datetime}
                condition={describe(period.condition)[0]}
                class="mx-auto size-6 text-fg-dim"
              />
            ))}
            <span aria-hidden="true" />
            {periods.map((period) => (
              <span
                key={period.datetime}
                class="tnum text-center text-base font-medium"
              >
                {degrees(period.temperature)}
              </span>
            ))}
            {metricIcon('size-3 text-fg-dim')}
            {periods.map((period) => (
              <span
                key={period.datetime}
                class="tnum text-center text-xs text-fg-dim"
              >
                {metricValue(metric, period)}
              </span>
            ))}
          </div>
        </div>
      </Tile>
      {open && (
        <WeatherSheet
          tile={tile}
          store={store}
          now={now}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

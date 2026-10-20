import { DropletIcon } from '@/components/icons/droplet-icon.tsx';
import { WeatherIcon } from '@/components/icons/weather-icon.tsx';
import type { IconCondition } from '@/components/icons/weather-icon.tsx';
import type { TileConfig } from '@/config/config.ts';
import { useSnapshot } from '@/hooks/use-snapshot.ts';
import { haStore } from '@/services/ha/instance.ts';
import type { ForecastItem, HaStore } from '@/services/ha/store.ts';

import { Tile, Unavailable } from './base/tile.tsx';
import type { TileState } from './base/tile.tsx';

/** Every HA weather condition, with the icon and label the tile shows. */
const CONDITIONS: Record<string, [IconCondition, string]> = {
  sunny: ['sunny', 'Sunny'],
  'clear-night': ['clear-night', 'Clear'],
  partlycloudy: ['partlycloudy', 'Partly cloudy'],
  cloudy: ['cloudy', 'Cloudy'],
  exceptional: ['cloudy', 'Exceptional'],
  windy: ['cloudy', 'Windy'],
  'windy-variant': ['cloudy', 'Windy'],
  rainy: ['rainy', 'Rain'],
  pouring: ['rainy', 'Heavy rain'],
  snowy: ['snowy', 'Snow'],
  'snowy-rainy': ['snowy', 'Sleet'],
  hail: ['snowy', 'Hail'],
  fog: ['fog', 'Fog'],
  lightning: ['lightning', 'Thunder'],
  'lightning-rainy': ['lightning', 'Thunderstorm'],
};

const describe = (condition: string | undefined): [IconCondition, string] =>
  CONDITIONS[condition ?? ''] ?? ['cloudy', 'Unknown'];

const STEP_HOURS = 3;
const PERIODS = 5;

/** Every third hourly period from now on, as the design shows. */
export const pickForecast = (items: ForecastItem[], now: Date) => {
  const upcoming = items.filter(
    (item) => new Date(item.datetime).getTime() > now.getTime(),
  );
  return Array.from(
    { length: PERIODS },
    (_, i) => upcoming[(i + 1) * STEP_HOURS - 1],
  ).filter((item): item is ForecastItem => item !== undefined);
};

const degrees = (value: unknown) =>
  typeof value === 'number' ? `${Math.round(value)}°` : '–';

const percent = (value: unknown) =>
  typeof value === 'number' ? `${Math.round(value)}%` : '–';

/** The hourly item for the current hour: HA's list starts there. */
export const currentPeriod = (items: ForecastItem[], now: Date) =>
  items.findLast(
    (item) => new Date(item.datetime).getTime() <= now.getTime(),
  ) ?? items[0];

const hour = (datetime: string) =>
  new Date(datetime).getHours().toString().padStart(2, '0');

/**
 * Current conditions and a short forecast. While HA is unreachable it keeps
 * showing the last known state, dimmed and badged stale.
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
  const [status, subscribed, entity, forecast] = useSnapshot(
    store,
    (s) => [s.status, s.subscribed, s.entities[id], s.forecasts[id]] as const,
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
  const periods = pickForecast(forecast ?? [], at);
  const rainNow = currentPeriod(forecast ?? [], at)?.precipitation_probability;
  return (
    <Tile place={tile} state={state}>
      <div class="flex h-full items-center gap-4">
        <div class="flex shrink-0 items-center gap-3">
          <WeatherIcon condition={icon} class="size-16 text-fg" />
          <div>
            <div class="tnum text-5xl leading-none font-semibold">
              {degrees(entity.attributes.temperature)}
            </div>
            <div class="mt-1 w-28 truncate text-sm text-fg-dim">{label}</div>
            <div class="mt-1 flex items-center gap-1 text-sm text-fg-dim">
              <DropletIcon class="size-3.5" />
              <span class="tnum">{percent(rainNow)}</span>
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
          <DropletIcon class="size-3 text-fg-dim" />
          {periods.map((period) => (
            <span
              key={period.datetime}
              class="tnum text-center text-xs text-fg-dim"
            >
              {percent(period.precipitation_probability)}
            </span>
          ))}
        </div>
      </div>
    </Tile>
  );
};

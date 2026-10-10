import type { GridArea } from '../grid.ts';
import { Tile, Unavailable } from './tile.tsx';
import type { TileState } from './tile.tsx';
import { haStore } from '../ha/instance.ts';
import type { ForecastItem, HaStore } from '../ha/store.ts';
import { useSnapshot } from '../ha/use-snapshot.ts';
import { WeatherIcon } from '../icons/weather-icon.tsx';
import type { IconCondition } from '../icons/weather-icon.tsx';

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

const hour = (datetime: string) =>
  new Date(datetime).getHours().toString().padStart(2, '0');

/**
 * Current conditions and a short forecast. While HA is unreachable it keeps
 * showing the last known state, dimmed and badged stale.
 */
export const WeatherTile = ({
  area,
  store = haStore,
  now = () => new Date(),
}: {
  area: GridArea;
  store?: HaStore;
  now?: () => Date;
}) => {
  const { status, subscribed, entities, forecasts } = useSnapshot(store);
  const entity = entities.weather;
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

  if (state === 'loading') return <Tile area={area} state="loading" />;
  if (!usable || !entity) {
    return (
      <Tile area={area} state="unavailable">
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
  const periods = pickForecast(forecasts.weather ?? [], now());
  return (
    <Tile area={area} state={state}>
      <div class="flex h-full items-center gap-4">
        <div class="flex shrink-0 items-center gap-3">
          <WeatherIcon condition={icon} class="size-16 text-fg" />
          <div>
            <div class="tnum text-5xl leading-none font-semibold">
              {degrees(entity.attributes.temperature)}
            </div>
            <div class="mt-1 w-28 truncate text-sm text-fg-dim">{label}</div>
          </div>
        </div>
        <div class="grid min-w-0 flex-1 grid-cols-5 gap-1 border-l border-line pl-3">
          {periods.map((period) => (
            <div key={period.datetime} class="flex flex-col items-center gap-1">
              <span class="tnum text-xs text-fg-dim">
                {hour(period.datetime)}
              </span>
              <WeatherIcon
                condition={describe(period.condition)[0]}
                class="size-6 text-fg-dim"
              />
              <span class="tnum text-base font-medium">
                {degrees(period.temperature)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Tile>
  );
};

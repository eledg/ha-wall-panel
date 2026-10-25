import type { HassEntity } from 'home-assistant-js-websocket';

import { getConfig } from '@/config/config.ts';
import { hourOf } from '@/config/datetime.ts';
import { isUsable, num } from '@/services/ha/entity.ts';
import type { ForecastItem } from '@/services/ha/store.ts';

/** The conditions the design has an icon for. */
export type IconCondition =
  | 'sunny'
  | 'clear-night'
  | 'partlycloudy'
  | 'cloudy'
  | 'rainy'
  | 'snowy'
  | 'fog'
  | 'lightning';

/** Every HA weather condition, with the icon and label the weather UI shows. */
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

export const describe = (
  condition: string | undefined,
): [IconCondition, string] =>
  CONDITIONS[condition ?? ''] ?? ['cloudy', 'Unknown'];

/** The default strip: every third hour, five columns, as the tile and the design show. */
export const DEFAULT_STEP_HOURS = 3;
export const DEFAULT_PERIODS = 5;

/**
 * Every `step`th hourly period from now on, up to `count` of them. The first
 * is `step` hours ahead. The forecast may be shorter than the strip asks for.
 */
export const pickForecast = (
  items: ForecastItem[],
  now: Date,
  step = DEFAULT_STEP_HOURS,
  count = DEFAULT_PERIODS,
) => {
  const upcoming = items.filter(
    (item) => new Date(item.datetime).getTime() > now.getTime(),
  );
  return Array.from(
    { length: count },
    (_, i) => upcoming[(i + 1) * step - 1],
  ).filter((item): item is ForecastItem => item !== undefined);
};

/** The hourly item for the current hour: HA's list starts there. */
export const currentPeriod = (items: ForecastItem[], now: Date) =>
  items.findLast(
    (item) => new Date(item.datetime).getTime() <= now.getTime(),
  ) ?? items[0];

export const degrees = (value: unknown) =>
  typeof value === 'number' ? `${Math.round(value)}°` : '–';

export const percent = (value: unknown) =>
  typeof value === 'number' ? `${Math.round(value)}%` : '–';

/** The hour of a forecast time on the display's clock, as two digits. */
export const hour = (datetime: string) =>
  hourOf(new Date(datetime)).toString().padStart(2, '0');

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/** The point of the compass a bearing in degrees falls in. */
export const compass = (bearing: number) =>
  COMPASS[Math.round(bearing / 45) % COMPASS.length]!;

/**
 * The weekday of a daily item: HA dates each one midnight UTC, so the UTC date
 * is the day, whatever the display's own zone says.
 */
export const dayLabel = (datetime: string, index: number) => {
  if (index === 0) return 'Today';
  return new Intl.DateTimeFormat(getConfig().locale, {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(datetime));
};

/** Narrowest a range bar is drawn, so a day with no spread is still visible. */
const MIN_BAR = 8;

export type WeekRange = { low: number; high: number };

/** The coldest low and warmest high of the days that report them, or `undefined` if none do. */
export const weekRange = (days: ForecastItem[]): WeekRange | undefined => {
  const lows = days.flatMap((d) => num(d.templow) ?? []);
  const highs = days.flatMap((d) => num(d.temperature) ?? []);
  const all = [...lows, ...highs];
  if (all.length === 0) return undefined;
  return { low: Math.min(...all), high: Math.max(...all) };
};

/**
 * Where one day's bar sits across the week, as percentages of the track:
 * from its low to its high. `undefined` when the day reports neither.
 */
export const rangeBar = (day: ForecastItem, week: WeekRange) => {
  const high = num(day.temperature);
  const low = num(day.templow);
  if (high === undefined && low === undefined) return undefined;
  const span = Math.max(1, week.high - week.low);
  const from = low ?? high!;
  const to = high ?? low!;
  const left = ((from - week.low) / span) * 100;
  const width = Math.max(MIN_BAR, ((to - from) / span) * 100);
  // A bar pushed past the end by the minimum width slides back inside.
  return { left: Math.min(left, 100 - width), width };
};

/** A reading with the unit HA gave it. */
export type Measure = { value: number; unit?: string };

const unitOf = (entity: HassEntity, name: string) => {
  const unit = entity.attributes[`${name}_unit`];
  return typeof unit === 'string' ? unit : undefined;
};

/** A numeric attribute with its `*_unit`, or `undefined` when the entity lacks it. */
const measure = (
  entity: HassEntity,
  name: string,
  unitName = name,
): Measure | undefined => {
  const value = num(entity.attributes[name]);
  return value === undefined
    ? undefined
    : { value, unit: unitOf(entity, unitName) };
};

export type WindView = {
  speed: Measure;
  /** The strongest gust this hour, in the same unit as the speed. */
  gust?: number;
  /** Compass point the wind blows from. */
  direction?: string;
  bearing?: number;
};

export type WeatherView = {
  usable: boolean;
  icon: IconCondition;
  label: string;
  temperature?: number;
  /** From the forecast: the entity itself has no feels-like. */
  feelsLike?: number;
  /** Today's high and low from the daily forecast. */
  high?: number;
  low?: number;
  humidity?: number;
  uvIndex?: number;
  dewPoint?: number;
  pressure?: Measure;
  visibility?: Measure;
  wind?: WindView;
  sunrise?: Date;
  sunset?: Date;
};

const time = (raw: unknown) => {
  if (typeof raw !== 'string') return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

/**
 * Everything the weather sheet shows, with each figure present only when the
 * entity or its forecast reports it. The feels-like and gust come from the
 * current hour of the hourly forecast, today's range from the daily one, and
 * sunrise and sunset from an optional `sun.sun`.
 */
export const readWeather = (
  entity: HassEntity | undefined,
  hourly: ForecastItem[] = [],
  daily: ForecastItem[] = [],
  sun: HassEntity | undefined,
  now: Date,
): WeatherView => {
  const [icon, label] = describe(entity?.state);
  if (!entity || !isUsable(entity)) return { usable: false, icon, label };
  const period = currentPeriod(hourly, now);
  const speed = measure(entity, 'wind_speed', 'wind_speed');
  const bearing = num(entity.attributes.wind_bearing);
  return {
    usable: true,
    icon,
    label,
    temperature: num(entity.attributes.temperature),
    feelsLike: num(period?.apparent_temperature),
    high: num(daily[0]?.temperature),
    low: num(daily[0]?.templow),
    humidity: num(entity.attributes.humidity),
    uvIndex: num(entity.attributes.uv_index),
    dewPoint: num(entity.attributes.dew_point),
    pressure: measure(entity, 'pressure'),
    visibility: measure(entity, 'visibility'),
    wind: speed && {
      speed,
      gust: num(period?.wind_gust_speed),
      bearing,
      direction: bearing === undefined ? undefined : compass(bearing),
    },
    sunrise: time(sun?.attributes.next_rising),
    sunset: time(sun?.attributes.next_setting),
  };
};

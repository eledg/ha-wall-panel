import type { ForecastItem } from '@/services/ha/store.ts';

type Period = [condition: string, temperature: number];

export type WeatherScenario = {
  id: string;
  label: string;
  state: string;
  attributes: Record<string, unknown>;
  /** The five forecast columns the tile shows, three hours apart. */
  periods: Period[];
  /** Overrides the generated hourly items. */
  forecast?: (start: number) => ForecastItem[];
  /** Overrides the generated daily items. */
  daily?: (start: number) => ForecastItem[];
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const STEP = 3;
/** HA's hourly forecast: the current hour and the 48 after it. */
const HOURLY_ITEMS = 49;
const DAILY_ITEMS = 7;

/**
 * HA's Met Office entity: hourly, daily and twice-daily forecasts. It reports
 * no feels-like, gust or cloud cover; wind is in km/h.
 */
const BASE = { temperature_unit: '°C', supported_features: 7 };
const ATTRIBUTES = {
  ...BASE,
  dew_point: 3.1,
  humidity: 57,
  uv_index: 2,
  pressure: 1013.2,
  pressure_unit: 'hPa',
  wind_bearing: 271,
  wind_speed: 38.8,
  wind_speed_unit: 'km/h',
  visibility: 23.3,
  visibility_unit: 'km',
  precipitation_unit: 'mm',
};

const scenario = (
  id: string,
  label: string,
  state: string,
  temperature: number,
  periods: Period[],
  extra: Partial<WeatherScenario> = {},
): WeatherScenario => ({
  id,
  label,
  state,
  attributes: { ...ATTRIBUTES, temperature },
  periods,
  ...extra,
});

const hourlyPeriods: Period[] = [
  ['partlycloudy', 15],
  ['sunny', 16],
  ['partlycloudy', 15],
  ['cloudy', 13],
  ['cloudy', 12],
];

/** Midnight UTC of the day containing `time`: where HA's daily items sit. */
const midnight = (time: number) => Math.floor(time / DAY) * DAY;

/**
 * Permutations for checking the weather tile by eye. Each one exercises
 * something the others do not; see `docs/mock.md`. A function, not a
 * constant, so the bundler can drop it from production builds.
 */
export const weatherScenarios = (): WeatherScenario[] => [
  scenario('sunny', 'Sunny', 'sunny', 10.6, [
    ['sunny', 12],
    ['sunny', 13],
    ['partlycloudy', 12],
    ['clear-night', 9],
    ['clear-night', 7],
  ]),
  scenario('clear-night', 'Clear night', 'clear-night', 6.2, [
    ['clear-night', 5],
    ['clear-night', 4],
    ['clear-night', 4],
    ['partlycloudy', 5],
    ['sunny', 8],
  ]),
  scenario('partlycloudy', 'Partly cloudy', 'partlycloudy', 14, [
    ['partlycloudy', 15],
    ['sunny', 16],
    ['partlycloudy', 15],
    ['cloudy', 13],
    ['cloudy', 12],
  ]),
  scenario('cloudy', 'Cloudy', 'cloudy', 12.4, [
    ['cloudy', 12],
    ['cloudy', 12],
    ['cloudy', 11],
    ['cloudy', 11],
    ['partlycloudy', 10],
  ]),
  scenario('rainy', 'Rain', 'rainy', 13, [
    ['rainy', 12],
    ['rainy', 11],
    ['rainy', 10],
    ['cloudy', 9],
    ['partlycloudy', 8],
  ]),
  scenario('pouring', 'Heavy rain', 'pouring', 11, [
    ['pouring', 11],
    ['pouring', 10],
    ['rainy', 10],
    ['rainy', 9],
    ['cloudy', 9],
  ]),
  scenario('lightning-rainy', 'Thunderstorm', 'lightning-rainy', 19, [
    ['lightning-rainy', 18],
    ['lightning', 17],
    ['pouring', 16],
    ['rainy', 15],
    ['cloudy', 14],
  ]),
  scenario('snowy', 'Snow', 'snowy', -1, [
    ['snowy', -1],
    ['snowy', -2],
    ['snowy-rainy', -3],
    ['cloudy', -2],
    ['clear-night', -4],
  ]),
  scenario('fog', 'Fog', 'fog', 7, [
    ['fog', 7],
    ['fog', 7],
    ['fog', 8],
    ['cloudy', 10],
    ['sunny', 12],
  ]),
  scenario('all-icons', 'All icons', 'sunny', 15, [
    ['clear-night', 15],
    ['partlycloudy', 14],
    ['rainy', 13],
    ['snowy', 1],
    ['lightning', 16],
  ]),
  scenario('extremes', 'Extremes', 'snowy', -12.4, [
    ['snowy', -15],
    ['fog', -9],
    ['sunny', 38],
    ['sunny', 39],
    ['clear-night', 100],
  ]),
  scenario('odd-data', 'Odd data', 'exceptional', 0, [], {
    // No temperature attribute at all, and forecast items with holes.
    attributes: { ...ATTRIBUTES },
    forecast: (start) =>
      Array.from({ length: 24 }, (_, hour) => ({
        datetime: new Date(start + (hour + 1) * HOUR).toISOString(),
        ...(hour % 6 < 3 ? { condition: 'banana', temperature: 9 } : {}),
      })),
    daily: (start) =>
      Array.from({ length: DAILY_ITEMS }, (_, day) => ({
        datetime: new Date(midnight(start) + day * DAY).toISOString(),
        ...(day % 2 ? { condition: 'banana', temperature: 9 } : {}),
      })),
  }),
  scenario('sparse', 'Sparse data', 'cloudy', 9, [['cloudy', 9]], {
    // What a thin integration gives: no wind, humidity or pressure at all, and
    // forecast items with only a time, a condition and a temperature.
    attributes: { ...BASE, temperature: 9 },
    forecast: (start) =>
      Array.from({ length: HOURLY_ITEMS }, (_, i) => ({
        datetime: new Date(start + i * HOUR).toISOString(),
        condition: 'cloudy',
        temperature: 9,
      })),
    daily: (start) =>
      Array.from({ length: DAILY_ITEMS }, (_, day) => ({
        datetime: new Date(midnight(start) + day * DAY).toISOString(),
        condition: 'cloudy',
        temperature: 10,
        templow: 5,
      })),
  }),
  scenario('hourly-only', 'Hourly only', 'partlycloudy', 14, hourlyPeriods, {
    // No daily forecast, so the store never asks for one.
    attributes: { ...ATTRIBUTES, temperature: 14, supported_features: 2 },
  }),
  scenario('daily-only', 'Daily only', 'partlycloudy', 14, [], {
    // No hourly forecast: the tile shows current conditions, the sheet the week.
    attributes: { ...ATTRIBUTES, temperature: 14, supported_features: 1 },
  }),
  scenario('no-forecast', 'No forecast', 'cloudy', 11, [], {
    // The entity has no forecasts, so the store never asks for one.
    attributes: { ...ATTRIBUTES, temperature: 11, supported_features: 0 },
  }),
  scenario('short-forecast', 'Short forecast', 'rainy', 12, [], {
    forecast: (start) =>
      Array.from({ length: 7 }, (_, hour) => ({
        datetime: new Date(start + (hour + 1) * HOUR).toISOString(),
        condition: hour < 4 ? 'rainy' : 'cloudy',
        temperature: 12 - hour,
        precipitation_probability: hour < 4 ? 85 : 20,
      })),
  }),
];

/** Plausible rain chance: wet conditions high, dry ones low. */
const rainChance = (condition: string | undefined) => {
  if (condition === 'rainy' || condition === 'pouring') return 85;
  if (condition === 'lightning' || condition === 'lightning-rainy') return 90;
  if (condition === 'snowy') return 80;
  if (condition === 'fog') return 30;
  if (condition === 'cloudy') return 20;
  if (condition === 'partlycloudy') return 10;
  return 0;
};

/** Rain in mm an hour, by condition; HA gives none for dry hours it has no figure for. */
const rainMm = (condition: string | undefined) => {
  if (condition === 'pouring') return 3.2;
  if (condition === 'lightning-rainy') return 2.4;
  if (condition === 'rainy') return 0.8;
  if (condition === 'snowy') return 0.5;
  return 0;
};

/** Wind, as the Met Office entity gives it for a period: km/h, with a gust and a bearing. */
const windFor = (step: number) => ({
  wind_speed: 22 + (step % 7) * 3,
  wind_gust_speed: 40 + (step % 5) * 4,
  wind_bearing: 250 + ((step * 9) % 50),
});

/**
 * HA's hourly forecast: 49 items, the first for the current hour (so its time
 * is not in the future) and one per hour after. Hour `h` ahead belongs to
 * forecast column `h / 3`. Every few hours the rain amount is `null`.
 */
export const forecastFor = (
  { periods, forecast }: WeatherScenario,
  start: number,
): ForecastItem[] => {
  if (forecast) return forecast(start);
  return Array.from({ length: HOURLY_ITEMS }, (_, i) => {
    const hour = Math.max(i - 1, 0);
    const [condition, temperature] =
      periods[Math.min(Math.floor(hour / STEP), periods.length - 1)] ?? [];
    return {
      datetime: new Date(start + i * HOUR).toISOString(),
      condition,
      temperature,
      apparent_temperature:
        temperature === undefined ? undefined : temperature - 2,
      precipitation_probability: rainChance(condition),
      precipitation: i % 5 === 4 ? null : rainMm(condition),
      uv_index: condition === 'clear-night' ? 0 : 2,
      pressure: 1000,
      ...windFor(i),
    };
  });
};

/** The conditions of the week, after today's, and each day's change from today's high. */
const WEEK: [condition: string, change: number][] = [
  ['partlycloudy', 1],
  ['cloudy', -1],
  ['rainy', -2],
  ['partlycloudy', 0],
  ['sunny', 2],
  ['cloudy', 1],
];

/**
 * HA's daily forecast: seven days from today, each dated midnight UTC. There
 * is no rain amount (HA's is always `null`) and the high is `temperature`.
 */
export const dailyFor = (
  { state, attributes, daily }: WeatherScenario,
  start: number,
): ForecastItem[] => {
  if (daily) return daily(start);
  const today =
    typeof attributes.temperature === 'number' ? attributes.temperature : 10;
  return Array.from({ length: DAILY_ITEMS }, (_, day) => {
    const [condition, change] = day === 0 ? [state, 0] : WEEK[day - 1]!;
    const high = Math.round(today + change + 1);
    return {
      datetime: new Date(midnight(start) + day * DAY).toISOString(),
      condition,
      temperature: high,
      templow: high - 5 - (day % 2),
      apparent_temperature: high - 2,
      precipitation_probability: rainChance(condition),
      precipitation: null,
      uv_index: 2,
      pressure: 1000,
      ...windFor(day * 3),
    };
  });
};

/** The next time of day (UTC, in hours) at or after `from`, as an ISO string. */
const nextAt = (from: number, hours: number) => {
  const at = midnight(from) + hours * HOUR;
  return new Date(at > from ? at : at + DAY).toISOString();
};

/** The attributes of `sun.sun` that the weather sheet reads. */
export const sunAttributes = (now: number) => ({
  next_rising: nextAt(now, 6.8),
  next_setting: nextAt(now, 16.5),
});

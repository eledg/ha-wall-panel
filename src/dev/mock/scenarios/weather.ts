import type { ForecastItem } from '@/services/ha/store.ts';

type Period = [condition: string, temperature: number];

export type WeatherScenario = {
  id: string;
  label: string;
  state: string;
  attributes: Record<string, unknown>;
  /** The five forecast columns the tile shows, three hours apart. */
  periods: Period[];
  /** Overrides the generated 24 hourly items. */
  forecast?: (start: number) => ForecastItem[];
};

const HOUR = 3_600_000;
const STEP = 3;

/** HA's Met Office entity: hourly, daily and twice-daily forecasts. */
const ATTRIBUTES = { temperature_unit: '°C', supported_features: 7 };

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
  }),
  scenario('no-forecast', 'No forecast', 'cloudy', 11, [], {
    // The entity has no hourly forecast, so the store never asks for one.
    attributes: { ...ATTRIBUTES, temperature: 11, supported_features: 1 },
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

/** 24 hourly items; hour `h` ahead belongs to forecast column `h / 3`. */
export const forecastFor = (
  { periods, forecast }: WeatherScenario,
  start: number,
): ForecastItem[] => {
  if (forecast) return forecast(start);
  return Array.from({ length: 24 }, (_, hour) => {
    const [condition, temperature] =
      periods[Math.min(Math.floor(hour / STEP), periods.length - 1)] ?? [];
    return {
      datetime: new Date(start + (hour + 1) * HOUR).toISOString(),
      condition,
      temperature,
      precipitation_probability: rainChance(condition),
    };
  });
};

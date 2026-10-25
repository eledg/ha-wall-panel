import { describe, expect, it } from 'vitest';

import {
  dailyFor,
  forecastFor,
  sunAttributes,
  weatherScenarios,
} from './weather.ts';

const start = Date.parse('2026-01-05T09:30:00Z');

const WEATHER_SCENARIOS = weatherScenarios();

describe('weatherScenarios', () => {
  it('has unique ids and labels', () => {
    const ids = WEATHER_SCENARIOS.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    const labels = WEATHER_SCENARIOS.map(({ label }) => label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('starts on the real Met Office baseline', () => {
    expect(WEATHER_SCENARIOS[0]).toMatchObject({
      id: 'sunny',
      attributes: { temperature: 10.6, supported_features: 7 },
    });
  });
});

describe('forecastFor', () => {
  it("generates HA's 49 hourly items, from the current hour", () => {
    const rain = WEATHER_SCENARIOS.find(({ id }) => id === 'rainy')!;
    const items = forecastFor(rain, start);

    expect(items).toHaveLength(49);
    expect(Date.parse(items[0]!.datetime)).toBe(start);
    expect(Date.parse(items[1]!.datetime)).toBe(start + 3_600_000);
    // The tile takes the 3rd, 6th, ... upcoming item: those are the columns.
    const picked = [3, 6, 9, 12, 15].map((i) => items[i]);
    expect(picked.map((item) => [item?.condition, item?.temperature])).toEqual(
      rain.periods,
    );
  });

  it('gives the fields the sheet reads, with some rain amounts null', () => {
    const items = forecastFor(WEATHER_SCENARIOS[0]!, start);

    expect(items[0]).toMatchObject({
      apparent_temperature: expect.any(Number),
      wind_speed: expect.any(Number),
      wind_gust_speed: expect.any(Number),
      wind_bearing: expect.any(Number),
    });
    expect(items.some((item) => item.precipitation === null)).toBe(true);
  });

  it('lets a scenario override the generated forecast', () => {
    const short = WEATHER_SCENARIOS.find(({ id }) => id === 'short-forecast')!;
    expect(forecastFor(short, start)).toHaveLength(7);
  });
});

describe('dailyFor', () => {
  it('generates seven days from today, dated midnight UTC, with no rain amount', () => {
    const days = dailyFor(WEATHER_SCENARIOS[0]!, start);

    expect(days).toHaveLength(7);
    expect(days[0]!.datetime).toBe('2026-01-05T00:00:00.000Z');
    expect(days[6]!.datetime).toBe('2026-01-11T00:00:00.000Z');
    expect(days.every((day) => day.precipitation === null)).toBe(true);
    expect(days.every((day) => day.templow! < day.temperature!)).toBe(true);
  });
});

describe('sunAttributes', () => {
  it('gives the next rising and setting, both in the future', () => {
    const { next_rising, next_setting } = sunAttributes(start);

    expect(Date.parse(next_rising)).toBeGreaterThan(start);
    expect(Date.parse(next_setting)).toBeGreaterThan(start);
  });
});

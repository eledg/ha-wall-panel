import { describe, expect, it } from 'vitest';

import { forecastFor, weatherScenarios } from './weather.ts';

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
  it('generates 24 hourly future items, three hours per column', () => {
    const rain = WEATHER_SCENARIOS.find(({ id }) => id === 'rainy')!;
    const items = forecastFor(rain, start);

    expect(items).toHaveLength(24);
    expect(Date.parse(items[0]!.datetime)).toBe(start + 3_600_000);
    // The store takes the 3rd, 6th, ... upcoming item: those are the columns.
    const picked = [2, 5, 8, 11, 14].map((i) => items[i]);
    expect(picked.map((item) => [item?.condition, item?.temperature])).toEqual(
      rain.periods,
    );
  });

  it('lets a scenario override the generated forecast', () => {
    const short = WEATHER_SCENARIOS.find(({ id }) => id === 'short-forecast')!;
    expect(forecastFor(short, start)).toHaveLength(7);
  });
});

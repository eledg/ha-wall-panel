import type { HassEntity } from 'home-assistant-js-websocket';
import { describe, expect, it } from 'vitest';

import type { ForecastItem } from '@/services/ha/store.ts';

import {
  compass,
  currentPeriod,
  dayLabel,
  degrees,
  describe as describeCondition,
  metricValue,
  pickForecast,
  rangeBar,
  readWeather,
  weekRange,
} from './weather-model.ts';

const entity = (
  state: string,
  attributes: Record<string, unknown> = {},
): HassEntity =>
  ({
    entity_id: 'weather.home',
    state,
    attributes,
    last_changed: '',
    last_updated: '',
    context: { id: '', parent_id: null, user_id: null },
  }) as HassEntity;

const now = new Date('2026-01-05T09:30:00Z');

describe('pickForecast', () => {
  it('takes every third future hour, up to five', () => {
    const now = new Date('2026-01-05T09:30:00Z');
    const items = Array.from({ length: 24 }, (_, i) => ({
      datetime: new Date(now.getTime() + (i + 1) * 3_600_000).toISOString(),
      temperature: i,
    }));
    expect(pickForecast(items, now).map((item) => item.temperature)).toEqual([
      2, 5, 8, 11, 14,
    ]);
  });

  it('takes the step and count it is given', () => {
    const items = Array.from({ length: 24 }, (_, i) => ({
      datetime: new Date(now.getTime() + (i + 1) * 3_600_000).toISOString(),
      temperature: i,
    }));

    expect(
      pickForecast(items, now, 2, 6).map((item) => item.temperature),
    ).toEqual([1, 3, 5, 7, 9, 11]);
    expect(pickForecast(items, now, 6, 3).map((i) => i.temperature)).toEqual([
      5, 11, 17,
    ]);
    expect(pickForecast(items, now, 1, 0)).toEqual([]);
  });

  it('stops where the forecast does', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      datetime: new Date(now.getTime() + (i + 1) * 3_600_000).toISOString(),
    }));

    expect(pickForecast(items, now, 4, 8)).toHaveLength(2);
  });

  it('returns what exists when the forecast is short', () => {
    expect(pickForecast([], new Date())).toEqual([]);
  });
});

describe('describe and degrees', () => {
  it('maps every condition and falls back to Unknown', () => {
    expect(describeCondition('pouring')).toEqual(['rainy', 'Heavy rain']);
    expect(describeCondition('banana')).toEqual(['cloudy', 'Unknown']);
    expect(describeCondition(undefined)).toEqual(['cloudy', 'Unknown']);
  });

  it('shows a dash for a missing temperature', () => {
    expect(degrees(11.6)).toBe('12°');
    expect(degrees(undefined)).toBe('–');
  });
});

describe('currentPeriod', () => {
  it('is the latest item that has started', () => {
    const items = [
      { datetime: '2026-01-05T09:00:00Z', temperature: 1 },
      { datetime: '2026-01-05T10:00:00Z', temperature: 2 },
    ];
    expect(currentPeriod(items, now)?.temperature).toBe(1);
  });
});

describe('compass', () => {
  it.each([
    [0, 'N'],
    [44, 'NE'],
    [271, 'W'],
    [350, 'N'],
  ])('puts %i degrees at %s', (bearing, point) => {
    expect(compass(bearing)).toBe(point);
  });
});

describe('dayLabel', () => {
  it('says Today for the first and names the rest by UTC date', () => {
    expect(dayLabel('2026-01-05T00:00:00Z', 0)).toBe('Today');
    expect(dayLabel('2026-01-06T00:00:00Z', 1)).toMatch(/Tue/);
  });
});

describe('weekRange and rangeBar', () => {
  const days: ForecastItem[] = [
    { datetime: 'a', temperature: 10, templow: 2 },
    { datetime: 'b', temperature: 18, templow: 8 },
    { datetime: 'c' },
  ];

  it('spans the coldest low to the warmest high', () => {
    expect(weekRange(days)).toEqual({ low: 2, high: 18 });
    expect(weekRange([{ datetime: 'x' }])).toBeUndefined();
  });

  it('places a bar across the week', () => {
    const week = weekRange(days)!;
    expect(rangeBar(days[0]!, week)).toEqual({ left: 0, width: 50 });
    expect(rangeBar(days[1]!, week)).toEqual({ left: 37.5, width: 62.5 });
    expect(rangeBar(days[2]!, week)).toBeUndefined();
  });

  it('keeps a day with no spread visible and inside the track', () => {
    const bar = rangeBar(
      { datetime: 'x', temperature: 18 },
      {
        low: 2,
        high: 18,
      },
    )!;
    expect(bar.width).toBe(8);
    expect(bar.left + bar.width).toBeLessThanOrEqual(100);
  });
});

describe('readWeather', () => {
  const hourly: ForecastItem[] = [
    {
      datetime: '2026-01-05T09:00:00Z',
      apparent_temperature: 8.2,
      wind_gust_speed: 61,
    },
  ];
  const daily: ForecastItem[] = [
    { datetime: '2026-01-05T00:00:00Z', temperature: 12, templow: 4 },
  ];
  const attributes = {
    temperature: 11.3,
    humidity: 57,
    uv_index: 2,
    dew_point: 3.1,
    pressure: 1000.38,
    pressure_unit: 'hPa',
    visibility: 23.28,
    visibility_unit: 'km',
    wind_speed: 38.77,
    wind_speed_unit: 'km/h',
    wind_bearing: 271,
  };

  it('reads every figure from the entity, forecasts and sun', () => {
    const sun = entity('above_horizon', {
      next_rising: '2026-01-06T07:58:00+00:00',
      next_setting: '2026-01-05T16:05:00+00:00',
    });
    const view = readWeather(
      entity('sunny', attributes),
      hourly,
      daily,
      sun,
      now,
    );

    expect(view).toMatchObject({
      usable: true,
      label: 'Sunny',
      temperature: 11.3,
      feelsLike: 8.2,
      high: 12,
      low: 4,
      humidity: 57,
      uvIndex: 2,
      dewPoint: 3.1,
      pressure: { value: 1000.38, unit: 'hPa' },
      visibility: { value: 23.28, unit: 'km' },
      wind: {
        speed: { value: 38.77, unit: 'km/h' },
        gust: 61,
        direction: 'W',
        bearing: 271,
      },
    });
    expect(view.sunrise?.toISOString()).toBe('2026-01-06T07:58:00.000Z');
    expect(view.sunset?.toISOString()).toBe('2026-01-05T16:05:00.000Z');
  });

  it('leaves out what is not reported', () => {
    const view = readWeather(
      entity('cloudy', { temperature: 9 }),
      undefined,
      undefined,
      undefined,
      now,
    );

    expect(view.temperature).toBe(9);
    for (const key of [
      'feelsLike',
      'high',
      'low',
      'humidity',
      'uvIndex',
      'dewPoint',
      'pressure',
      'visibility',
      'wind',
      'sunrise',
      'sunset',
    ] as const) {
      expect(view[key]).toBeUndefined();
    }
  });

  it('ignores a malformed sun time', () => {
    const sun = entity('above_horizon', { next_rising: 'soon' });
    expect(
      readWeather(entity('sunny'), [], [], sun, now).sunrise,
    ).toBeUndefined();
  });

  it('is not usable when the entity is missing or unavailable', () => {
    expect(readWeather(undefined, [], [], undefined, now).usable).toBe(false);
    expect(
      readWeather(entity('unavailable'), [], [], undefined, now).usable,
    ).toBe(false);
  });
});

describe('metricValue', () => {
  const item = {
    datetime: '2025-01-01T12:00:00Z',
    precipitation_probability: 40,
    uv_index: 3.4,
  } as ForecastItem;

  it('gives the chance of rain or the UV index', () => {
    expect(metricValue('rain', item)).toBe('40%');
    expect(metricValue('uv', item)).toBe('3');
  });

  it('gives a dash for a missing figure', () => {
    expect(metricValue('rain', undefined)).toBe('–');
    expect(metricValue('uv', { datetime: item.datetime })).toBe('–');
  });
});

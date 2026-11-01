import type { HassEntity } from 'home-assistant-js-websocket';
import { describe, expect, it } from 'vitest';

import { alertFixture } from '@/tests/weather-alerts.ts';

import {
  readWeatherAlerts,
  relevantWeatherAlerts,
  severityLabel,
} from './weather-alerts.ts';

const now = new Date('2026-10-31T12:00:00Z');
const { iso, alert } = alertFixture(now);

const sensor = (
  state: string,
  attributes: Record<string, unknown> = {},
): HassEntity =>
  ({
    entity_id: 'sensor.weather_warnings',
    state,
    attributes,
    last_changed: '',
    last_updated: '',
    context: { id: '', parent_id: null, user_id: null },
  }) as HassEntity;

describe('readWeatherAlerts', () => {
  it('reads the warnings attribute', () => {
    const entity = sensor('1', {
      warnings: [
        { id: 'x', severity: 'Amber', event: ' Rain ', starts: 's', ends: 'e' },
      ],
    });

    expect(readWeatherAlerts(entity)).toEqual([
      {
        id: 'x',
        severity: 'amber',
        event: 'Rain',
        title: 'Rain',
        starts: 's',
        ends: 'e',
        area: '',
        description: '',
        guidance: '',
        source: '',
      },
    ]);
  });

  it('is empty for a missing, unavailable or malformed sensor', () => {
    expect(readWeatherAlerts(undefined)).toEqual([]);
    expect(
      readWeatherAlerts(
        sensor('unavailable', {
          warnings: [{ severity: 'red', event: 'Wind' }],
        }),
      ),
    ).toEqual([]);
    expect(readWeatherAlerts(sensor('0'))).toEqual([]);
    expect(readWeatherAlerts(sensor('0', { warnings: 'none' }))).toEqual([]);
  });

  it('skips items without a known severity or an event', () => {
    const entity = sensor('3', {
      warnings: [
        null,
        'text',
        { severity: 'purple', event: 'Wind' },
        { severity: 'red' },
        { severity: 'red', event: 'Wind' },
      ],
    });

    expect(readWeatherAlerts(entity).map((a) => a.event)).toEqual(['Wind']);
  });
});

describe('relevantWeatherAlerts', () => {
  it('keeps warnings in force or to come', () => {
    const active = alert({ id: 'active' });
    const upcoming = alert({ id: 'upcoming', starts: iso(1), ends: iso(3) });

    expect(
      relevantWeatherAlerts([active, upcoming], now).map((a) => a.id),
    ).toEqual(['active', 'upcoming']);
  });

  it('drops expired warnings, including one ending right now', () => {
    expect(relevantWeatherAlerts([alert({ ends: iso(0) })], now)).toEqual([]);
    expect(
      relevantWeatherAlerts([alert({ starts: iso(-5), ends: iso(-1) })], now),
    ).toEqual([]);
  });

  it('drops warnings with unusable times', () => {
    expect(
      relevantWeatherAlerts(
        [
          alert({ starts: 'soon' }),
          alert({ ends: '' }),
          alert({ starts: iso(2), ends: iso(1) }),
        ],
        now,
      ),
    ).toEqual([]);
  });

  it('orders by severity, then by start', () => {
    const list = [
      alert({ id: 'yellow-late', starts: iso(2) }),
      alert({ id: 'yellow-early', starts: iso(-2) }),
      alert({ id: 'red', severity: 'red' }),
      alert({ id: 'amber', severity: 'amber' }),
    ];

    expect(relevantWeatherAlerts(list, now).map((a) => a.id)).toEqual([
      'red',
      'amber',
      'yellow-early',
      'yellow-late',
    ]);
  });
});

describe('severityLabel', () => {
  it('capitalises the severity', () => {
    expect(severityLabel(alert({ severity: 'amber' }))).toBe('Amber warning');
  });
});

import { describe, expect, it } from 'vitest';

import { acHistory, climateHistory } from './climate.ts';
import { DEMAND_BOUNDARIES } from './heating.ts';

const NOW = Date.UTC(2026, 9, 18, 12);

describe('climateHistory', () => {
  const { temperature, humidity } = climateHistory(NOW, DEMAND_BOUNDARIES, {
    temperature: 21.4,
    humidity: 48,
  });

  it('gives a sample every ten minutes across six hours', () => {
    expect(temperature).toHaveLength(37);
    expect(humidity).toHaveLength(37);
    expect(Date.parse(temperature[0]!.last_changed)).toBe(NOW - 6 * 3_600_000);
    expect(Date.parse(temperature.at(-1)!.last_changed)).toBe(NOW);
  });

  it('ends on the live readings', () => {
    expect(temperature.at(-1)!.state).toBe('21.4');
    expect(humidity.at(-1)!.state).toBe('48');
  });

  it('keeps humidity a whole percent and temperature to one decimal', () => {
    expect(humidity.every((r) => /^\d+$/.test(r.state))).toBe(true);
    expect(temperature.every((r) => /^\d+\.\d$/.test(r.state))).toBe(true);
  });
});

describe('acHistory', () => {
  it('alternates off and cool from the start of the window', () => {
    const rows = acHistory(NOW);

    expect(rows.map((r) => r.state)).toEqual([
      'off',
      'cool',
      'off',
      'cool',
      'off',
    ]);
    expect(Date.parse(rows[0]!.last_changed)).toBe(NOW - 6 * 3_600_000);
  });
});

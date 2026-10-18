import type { HassEntity } from 'home-assistant-js-websocket';
import { describe, expect, it } from 'vitest';

import { readTemperature } from './temperature-model.ts';

const entity = (state: string, attributes: Record<string, unknown> = {}) =>
  ({ state, attributes }) as HassEntity;

describe('readTemperature', () => {
  it('reads an attribute', () => {
    expect(
      readTemperature(
        entity('cool', { current_temperature: 21.4 }),
        'current_temperature',
      ).value,
    ).toBe(21.4);
  });

  it('reads the state of a sensor when no attribute is given', () => {
    expect(readTemperature(entity('19.5')).value).toBe(19.5);
  });

  it('accepts a numeric string attribute', () => {
    expect(readTemperature(entity('cool', { t: '22' }), 't').value).toBe(22);
  });

  it('gives undefined for a missing or non-numeric reading', () => {
    expect(
      readTemperature(entity('cool'), 'current_temperature').value,
    ).toBeUndefined();
    expect(
      readTemperature(entity('cool', { t: null }), 't').value,
    ).toBeUndefined();
    expect(readTemperature(entity('warm')).value).toBeUndefined();
    expect(readTemperature(entity('')).value).toBeUndefined();
  });

  it('gives undefined when the entity is unavailable or missing', () => {
    expect(
      readTemperature(entity('unavailable', { t: 20 }), 't').value,
    ).toBeUndefined();
    expect(readTemperature(entity('unknown')).value).toBeUndefined();
    expect(readTemperature(undefined).value).toBeUndefined();
  });
});

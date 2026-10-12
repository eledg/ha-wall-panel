import type { HassEntity } from 'home-assistant-js-websocket';
import { describe, expect, it } from 'vitest';

import { formatTemp, readTemp } from './temp-model.ts';

const entity = (state: string, attributes: Record<string, unknown> = {}) =>
  ({ state, attributes }) as HassEntity;

describe('readTemp', () => {
  it('reads an attribute', () => {
    expect(
      readTemp(
        entity('cool', { current_temperature: 21.4 }),
        'current_temperature',
      ).value,
    ).toBe(21.4);
  });

  it('reads the state of a sensor when no attribute is given', () => {
    expect(readTemp(entity('19.5')).value).toBe(19.5);
  });

  it('accepts a numeric string attribute', () => {
    expect(readTemp(entity('cool', { t: '22' }), 't').value).toBe(22);
  });

  it('gives undefined for a missing or non-numeric reading', () => {
    expect(
      readTemp(entity('cool'), 'current_temperature').value,
    ).toBeUndefined();
    expect(readTemp(entity('cool', { t: null }), 't').value).toBeUndefined();
    expect(readTemp(entity('warm')).value).toBeUndefined();
    expect(readTemp(entity('')).value).toBeUndefined();
  });

  it('gives undefined when the entity is unavailable or missing', () => {
    expect(
      readTemp(entity('unavailable', { t: 20 }), 't').value,
    ).toBeUndefined();
    expect(readTemp(entity('unknown')).value).toBeUndefined();
    expect(readTemp(undefined).value).toBeUndefined();
  });
});

describe('formatTemp', () => {
  it('shows one decimal', () => {
    expect(formatTemp(24)).toBe('24.0');
    expect(formatTemp(21.44)).toBe('21.4');
  });
});

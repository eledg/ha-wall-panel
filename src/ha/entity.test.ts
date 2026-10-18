import type { HassEntity } from 'home-assistant-js-websocket';
import { describe, expect, it } from 'vitest';

import { isUsable, num, parseNumber } from './entity.ts';

const entity = (state: string) => ({ state }) as unknown as HassEntity;

describe('isUsable', () => {
  it('is false for a missing, unavailable or unknown entity', () => {
    expect(isUsable(undefined)).toBe(false);
    expect(isUsable(entity('unavailable'))).toBe(false);
    expect(isUsable(entity('unknown'))).toBe(false);
    expect(isUsable(entity('off'))).toBe(true);
  });
});

describe('num and parseNumber', () => {
  it('num keeps only finite numbers', () => {
    expect(num(21.5)).toBe(21.5);
    expect(num('21.5')).toBeUndefined();
    expect(num(NaN)).toBeUndefined();
    expect(num(Infinity)).toBeUndefined();
  });

  it('parseNumber also reads numeric strings', () => {
    expect(parseNumber('21.5')).toBe(21.5);
    expect(parseNumber(' ')).toBeUndefined();
    expect(parseNumber('abc')).toBeUndefined();
    expect(parseNumber(null)).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';

import { isNight, msToNextBoundary } from './night.ts';

const at = (h: number, m = 0) => new Date(2026, 2, 14, h, m, 0, 0);

describe('isNight', () => {
  it('spans midnight', () => {
    expect(isNight(at(20, 59), 21, 7)).toBe(false);
    expect(isNight(at(21), 21, 7)).toBe(true);
    expect(isNight(at(0), 21, 7)).toBe(true);
    expect(isNight(at(6, 59), 21, 7)).toBe(true);
    expect(isNight(at(7), 21, 7)).toBe(false);
  });

  it('handles a range within one day', () => {
    expect(isNight(at(13), 13, 15)).toBe(true);
    expect(isNight(at(15), 13, 15)).toBe(false);
  });
});

describe('msToNextBoundary', () => {
  it('counts to the next start or end', () => {
    expect(msToNextBoundary(at(20, 30), 21, 7)).toBe(30 * 60_000);
    expect(msToNextBoundary(at(23), 21, 7)).toBe(8 * 3_600_000);
    expect(msToNextBoundary(at(21), 21, 7)).toBe(10 * 3_600_000);
  });
});

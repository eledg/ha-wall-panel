import { afterEach, describe, expect, it } from 'vitest';

import { applyConfig, getConfig } from '@/config/config.ts';
import { mockConfig } from '@/dev/mock/config.ts';

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

describe('with a configured time zone', () => {
  afterEach(() => applyConfig(mockConfig));

  it('judges night by the zone, not the machine', () => {
    applyConfig({ ...getConfig(), timeZone: 'Asia/Tokyo' });
    // 12:00 UTC is 21:00 in Tokyo, the start of the night.
    expect(isNight(new Date(Date.UTC(2026, 2, 14, 12)), 21, 7)).toBe(true);
    expect(isNight(new Date(Date.UTC(2026, 2, 14, 11, 59)), 21, 7)).toBe(false);
  });

  it('counts to the boundary in the zone', () => {
    applyConfig({ ...getConfig(), timeZone: 'Asia/Tokyo' });
    const now = new Date(Date.UTC(2026, 2, 14, 11, 30)); // 20:30 in Tokyo
    expect(msToNextBoundary(now, 21, 7)).toBe(30 * 60_000);
  });
});

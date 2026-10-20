import { afterEach, describe, expect, it } from 'vitest';

import { mockConfig } from '@/dev/mock/config.ts';

import { applyConfig, getConfig } from './config.ts';
import {
  dateFormat,
  hourOf,
  midnightOf,
  startOfDay,
  zonedInstant,
  zonedParts,
} from './datetime.ts';

const use = (locale?: string, timeZone?: string) =>
  applyConfig({ ...getConfig(), locale, timeZone });

afterEach(() => applyConfig(mockConfig));

describe('dateFormat', () => {
  const at = new Date(Date.UTC(2026, 2, 14, 21, 41));
  const time = { hour: '2-digit', minute: '2-digit' } as const;

  it('follows the configured locale', () => {
    use('en-GB', 'UTC');
    expect(dateFormat(time).format(at)).toBe('21:41');
    use('en-US', 'UTC');
    expect(dateFormat(time).format(at)).toBe('09:41 PM');
  });

  it('follows the configured time zone', () => {
    use('en-GB', 'America/New_York');
    expect(dateFormat(time).format(at)).toBe('17:41');
    use('en-GB', 'Asia/Tokyo');
    expect(dateFormat(time).format(at)).toBe('06:41');
  });

  it('names weekdays in the locale', () => {
    use('de-DE', 'UTC');
    expect(dateFormat({ weekday: 'long' }).format(at)).toBe('Samstag');
  });
});

describe('zoned helpers', () => {
  it('reads wall-clock fields in the zone', () => {
    use('en-GB', 'America/New_York');
    expect(zonedParts(new Date(Date.UTC(2026, 6, 1, 3, 30)))).toEqual({
      year: 2026,
      month: 6,
      day: 30,
      hour: 23,
      minute: 30,
      second: 0,
    });
    expect(hourOf(new Date(Date.UTC(2026, 0, 1, 12)))).toBe(7);
  });

  it('finds midnight either side of a DST change', () => {
    use('en-GB', 'Europe/London');
    // Clocks go forward on 2026-03-29: that day is 23 hours long.
    const before = startOfDay(new Date(Date.UTC(2026, 2, 28, 12)));
    const day = startOfDay(new Date(Date.UTC(2026, 2, 29, 12)));
    const after = startOfDay(new Date(Date.UTC(2026, 2, 29, 12)), 1);
    expect(before.toISOString()).toBe('2026-03-28T00:00:00.000Z');
    expect(day.toISOString()).toBe('2026-03-29T00:00:00.000Z');
    expect(after.toISOString()).toBe('2026-03-29T23:00:00.000Z');
  });

  it('puts an all-day date at midnight in the zone, not UTC', () => {
    use('en-GB', 'America/New_York');
    expect(midnightOf('2026-10-10').toISOString()).toBe(
      '2026-10-10T04:00:00.000Z',
    );
  });

  it('rolls overflowing fields over', () => {
    use('en-GB', 'UTC');
    expect(
      zonedInstant({ year: 2026, month: 12, day: 32, hour: 1 }).toISOString(),
    ).toBe('2027-01-01T01:00:00.000Z');
  });
});

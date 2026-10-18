import { describe, expect, it } from 'vitest';

import { msToNextMinute } from './use-minute.ts';

describe('msToNextMinute', () => {
  it('counts to the next whole minute', () => {
    expect(msToNextMinute(new Date(2026, 0, 5, 9, 30, 15, 250))).toBe(44_750);
    expect(msToNextMinute(new Date(2026, 0, 5, 9, 30, 0, 0))).toBe(60_000);
  });
});

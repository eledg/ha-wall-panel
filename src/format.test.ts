import { describe, expect, it } from 'vitest';

import { formatTime } from './format.ts';

describe('formatTime', () => {
  it('zero-pads and uses 24 hours', () => {
    expect(formatTime(new Date(2026, 2, 14, 9, 5))).toBe('09:05');
    expect(formatTime(new Date(2026, 2, 14, 21, 41))).toBe('21:41');
  });

  it('accepts epoch milliseconds', () => {
    expect(formatTime(new Date(2026, 2, 14, 7, 30).getTime())).toBe('07:30');
  });
});

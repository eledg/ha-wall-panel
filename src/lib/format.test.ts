import { describe, expect, it } from 'vitest';

import { formatTemp, formatTime } from './format.ts';

describe('formatTime', () => {
  it('zero-pads and uses 24 hours', () => {
    expect(formatTime(new Date(2026, 2, 14, 9, 5))).toBe('09:05');
    expect(formatTime(new Date(2026, 2, 14, 21, 41))).toBe('21:41');
  });

  it('accepts epoch milliseconds', () => {
    expect(formatTime(new Date(2026, 2, 14, 7, 30).getTime())).toBe('07:30');
  });
});

describe('formatTemp', () => {
  it('shows one decimal', () => {
    expect(formatTemp(24)).toBe('24.0');
    expect(formatTemp(21.44)).toBe('21.4');
  });
});

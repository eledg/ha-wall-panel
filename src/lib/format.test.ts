import { afterEach, describe, expect, it } from 'vitest';

import { applyConfig, getConfig } from '@/config/config.ts';
import { mockConfig } from '@/dev/mock/config.ts';

import { formatTemp, formatTime } from './format.ts';

afterEach(() => applyConfig(mockConfig));

describe('formatTime', () => {
  it('zero-pads and uses 24 hours', () => {
    expect(formatTime(new Date(2026, 2, 14, 9, 5))).toBe('09:05');
    expect(formatTime(new Date(2026, 2, 14, 21, 41))).toBe('21:41');
  });

  it('accepts epoch milliseconds', () => {
    expect(formatTime(new Date(2026, 2, 14, 7, 30).getTime())).toBe('07:30');
  });
});

describe('formatTime by locale and zone', () => {
  const at = new Date(Date.UTC(2026, 2, 14, 21, 41));

  it('uses the 24h clock for en-GB and 12h for en-US', () => {
    applyConfig({ ...getConfig(), locale: 'en-GB', timeZone: 'UTC' });
    expect(formatTime(at)).toBe('21:41');
    applyConfig({ ...getConfig(), locale: 'en-US', timeZone: 'UTC' });
    expect(formatTime(at)).toBe('09:41 PM');
  });

  it('shows the configured zone, not the machine', () => {
    applyConfig({ ...getConfig(), locale: 'en-GB', timeZone: 'Asia/Tokyo' });
    expect(formatTime(at)).toBe('06:41');
  });
});

describe('formatTemp', () => {
  it('shows one decimal', () => {
    expect(formatTemp(24)).toBe('24.0');
    expect(formatTemp(21.44)).toBe('21.4');
  });
});

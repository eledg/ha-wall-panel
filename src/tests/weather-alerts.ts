import type { WeatherAlert } from '@/lib/weather-alerts.ts';

const HOUR = 3_600_000;

/**
 * Warning fixtures relative to `now`: `iso(-1)` is an hour before it. The
 * default `alert()` is a yellow wind warning that started an hour ago and ends
 * in five.
 */
export const alertFixture = (now: Date) => {
  const iso = (offsetHours: number) =>
    new Date(now.getTime() + offsetHours * HOUR).toISOString();
  const alert = (overrides: Partial<WeatherAlert> = {}): WeatherAlert => ({
    id: 'wind',
    severity: 'yellow',
    event: 'Wind',
    title: 'Strong winds',
    starts: iso(-1),
    ends: iso(5),
    area: 'Berkhamsted',
    description: 'Gusts may cause disruption.',
    guidance: 'Secure loose items.',
    source: 'Sample warning',
    ...overrides,
  });
  return { iso, alert };
};

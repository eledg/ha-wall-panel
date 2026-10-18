import type { EntityKey } from '@/services/ha/store.ts';

/** Label and colour classes per calendar, as the design's `CAL_COLOR` / `CAL_TEXT`. */
export const CALENDARS: Partial<
  Record<EntityKey, { label: string; bar: string; text: string }>
> = {
  calendarFamily: {
    label: 'Family',
    bar: 'bg-cal-family',
    text: 'text-cal-family',
  },
  calendarBirthdays: {
    label: 'Birthdays',
    bar: 'bg-cal-birthdays',
    text: 'text-cal-birthdays',
  },
  calendarF1: { label: 'F1', bar: 'bg-cal-f1', text: 'text-cal-f1' },
};

export const FALLBACK = { label: '', bar: 'bg-fg-faint', text: 'text-fg-dim' };
export const meta = (key: EntityKey) => CALENDARS[key] ?? FALLBACK;

const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long' });

export const midnight = (date: Date, offsetDays = 0) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d;
};

/** `Today`, `Tmrw`, then the weekday. A multi-day event under way counts as today. */
export const dayLabel = (start: Date, now: Date) => {
  if (start < midnight(now, 1)) return 'Today';
  if (start < midnight(now, 2)) return 'Tmrw';
  return weekday.format(start);
};

/** Weekday names shorten to three letters (`Mon`); `Tmrw` is already short. */
export const shortDay = (label: string) =>
  label === 'Tmrw' ? label : label.slice(0, 3);

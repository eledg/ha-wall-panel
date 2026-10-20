import type { CalendarColor, CalendarSource } from '@/config/config.ts';

export type CalendarMeta = { label: string; bar: string; text: string };

/** Colour classes per palette name, as the design's `CAL_COLOR` / `CAL_TEXT`. */
export const COLOR_CLASSES: Record<
  CalendarColor,
  Omit<CalendarMeta, 'label'>
> = {
  yellow: { bar: 'bg-cal-yellow', text: 'text-cal-yellow' },
  blue: { bar: 'bg-cal-blue', text: 'text-cal-blue' },
  green: { bar: 'bg-cal-green', text: 'text-cal-green' },
};

export const FALLBACK: CalendarMeta = {
  label: '',
  bar: 'bg-fg-faint',
  text: 'text-fg-dim',
};

/** The label and colour classes of the calendar with entity ID `id`. */
export const meta = (sources: CalendarSource[], id: string): CalendarMeta => {
  const source = sources.find((s) => s.entity === id);
  return source
    ? { label: source.label, ...COLOR_CLASSES[source.color] }
    : FALLBACK;
};

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

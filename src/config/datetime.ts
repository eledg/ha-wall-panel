import { getConfig } from './config.ts';

/**
 * Locale and time zone for every date and time the panel shows or reasons
 * about. Both come from `config.json`; when unset they are the display's own
 * (`undefined` to `Intl`). Read at the point of use, never at import time,
 * because the config may not be loaded yet.
 */
const formatters = new Map<string, Intl.DateTimeFormat>();

const cached = (
  locale: string | undefined,
  timeZone: string | undefined,
  options: Intl.DateTimeFormatOptions,
) => {
  const key = JSON.stringify([locale, timeZone, options]);
  let format = formatters.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, { ...options, timeZone });
    formatters.set(key, format);
  }
  return format;
};

/** A formatter for the configured locale and time zone, cached per locale, zone and options. */
export const dateFormat = (options: Intl.DateTimeFormatOptions) => {
  const { locale, timeZone } = getConfig();
  return cached(locale, timeZone, options);
};

export type ZonedParts = {
  year: number;
  /** 1 to 12. */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const PART_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hourCycle: 'h23',
};

/** The wall-clock fields of `date` in the configured time zone. */
export const zonedParts = (date: Date): ZonedParts => {
  // Always en-US digits: only the numbers are wanted, not the locale's look.
  const format = cached('en-US', getConfig().timeZone, PART_OPTIONS);
  const found: Record<string, number> = {};
  for (const part of format.formatToParts(date)) {
    if (part.type !== 'literal') found[part.type] = Number(part.value);
  }
  return {
    year: found.year!,
    month: found.month!,
    day: found.day!,
    hour: found.hour!,
    minute: found.minute!,
    second: found.second!,
  };
};

/** The hour (0 to 23) of `date` in the configured time zone. */
export const hourOf = (date: Date) => zonedParts(date).hour;

const asUtc = (p: Partial<ZonedParts>) =>
  Date.UTC(
    p.year ?? 1970,
    (p.month ?? 1) - 1,
    p.day ?? 1,
    p.hour ?? 0,
    p.minute ?? 0,
    p.second ?? 0,
  );

/**
 * The instant at which the wall clock in the configured time zone reads the
 * given fields. Fields may overflow (day 32, hour 25) and roll over. In a gap
 * (clocks going forward) it gives the instant just after the gap.
 */
export const zonedInstant = (wanted: Partial<ZonedParts>): Date => {
  const target = asUtc(wanted);
  // Offset at a first guess, then once more at the corrected instant, which
  // settles on the right side of a DST change.
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const offset = asUtc(zonedParts(new Date(guess))) - guess;
    guess = target - offset;
  }
  return new Date(guess);
};

/** Midnight at the start of `date`'s day in the configured zone, plus `offsetDays`. */
export const startOfDay = (date: Date, offsetDays = 0) => {
  const { year, month, day } = zonedParts(date);
  return zonedInstant({ year, month, day: day + offsetDays });
};

/** `YYYY-MM-DD` as midnight in the configured zone. */
export const midnightOf = (isoDate: string) => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return zonedInstant({ year, month, day });
};

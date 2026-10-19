import type { Auth } from 'home-assistant-js-websocket';

import type { CalendarKind } from '@/config/config.ts';

/** How often calendar events are re-fetched; HA pushes no event when they change. */
export const CALENDAR_REFRESH_MS = 5 * 60_000;

/** Events older than this many missed refreshes are shown as stale. */
export const CALENDAR_STALE_MS = 3 * CALENDAR_REFRESH_MS;

/** How many days ahead of today the store fetches events for. */
export const CALENDAR_DAYS = 7;

/** One calendar event, reduced to what the tile and its detail sheet show. */
export type CalendarEvent = {
  /** Entity ID of the calendar the event came from. */
  calendar: string;
  /** The title for the tile's rows, shortened for some calendars (see `shortenF1`). */
  summary: string;
  /** The title as HA sends it, for the detail sheet. */
  fullSummary: string;
  location?: string;
  description?: string;
  /** ISO timestamps. An all-day event runs from local midnight to local midnight. */
  start: string;
  end: string;
  allDay: boolean;
};

/** An item from `GET /api/calendars/<entity_id>`, as far as the store reads it. */
export type RawCalendarEvent = {
  summary?: string;
  location?: string | null;
  description?: string | null;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
};

/** `YYYY-MM-DD` as local midnight; `new Date('2026-10-10')` would be UTC. */
const localMidnight = (date: string) => new Date(`${date}T00:00:00`);

/** The leading emoji (which may carry a variation selector), then `FORMULA 1`. */
const F1_TITLE = /^(\S+)\s+FORMULA 1\s.*\s-\s(.+)$/u;

/**
 * `🏁 FORMULA 1 SINGAPORE AIRLINES SINGAPORE GRAND PRIX 2026 - Race` becomes
 * `🏁 F1 Singapore - Race`. The grand prix name carries sponsors and varies by
 * race, so the place comes from the event's `location`. A title that doesn't fit
 * the pattern, or an event with no location, is left as it is.
 */
export const shortenF1 = (summary: string, location?: string | null) => {
  const match = F1_TITLE.exec(summary);
  const place = location?.trim();
  if (!match || !place) return summary;
  return `${match[1]} F1 ${place} - ${match[2]}`;
};

/**
 * Kinds of calendar whose descriptions aren't worth showing. F1's is the same
 * ~1.5 KB of promotional links on every event.
 */
const NO_NOTES = new Set<CalendarKind>(['f1']);

/** Trimmed text, or `undefined` when HA sends nothing, `null` or `""`. */
const textOf = (value?: string | null) => value?.trim() || undefined;

const ordinalRules = new Intl.PluralRules('en-GB', { type: 'ordinal' });
const ORDINAL_SUFFIX = {
  one: 'st',
  two: 'nd',
  few: 'rd',
  other: 'th',
} as const;

/** `1st`, `22nd`, `39th`. */
const ordinal = (n: number) =>
  `${n}${ORDINAL_SUFFIX[ordinalRules.select(n) as keyof typeof ORDINAL_SUFFIX] ?? 'th'}`;

const BIRTHDAY_TITLE = /^(.+?)(['\u2019]s) Birthday$/u;
const BORN_YEAR = /\bBorn (\d{4})\b/u;

/**
 * `Alex Example's Birthday` with a description of `Born 1977`, falling in
 * 2026, becomes `Alex Example's 49th Birthday`. Without a birth year (or with
 * a title that doesn't fit) the title is left as it is.
 */
export const withBirthdayAge = (
  summary: string,
  description: string | null | undefined,
  eventDate: Date,
) => {
  const match = BIRTHDAY_TITLE.exec(summary);
  const born = Number(BORN_YEAR.exec(description ?? '')?.[1]);
  const age = eventDate.getFullYear() - born;
  if (!match || !Number.isFinite(born) || age < 1) return summary;
  return `${match[1]}${match[2]} ${ordinal(age)} Birthday`;
};

/** Per-calendar tidying of titles that are too long for the tile. */
const SUMMARY_FORMATTERS: Partial<
  Record<CalendarKind, (summary: string, raw: RawCalendarEvent) => string>
> = {
  f1: (summary, raw) => shortenF1(summary, raw.location),
};

/**
 * Reduces a REST calendar item to a `CalendarEvent`, or `undefined` when it
 * has no usable times. Timed events carry a UTC offset that can differ between
 * items, so `Date` parses them. All-day `end` dates are exclusive in HA.
 */
export const normaliseEvent = (
  calendar: string,
  raw: RawCalendarEvent,
  kind?: CalendarKind,
): CalendarEvent | undefined => {
  const allDay = raw.start.date !== undefined;
  const start = allDay
    ? localMidnight(raw.start.date ?? '')
    : new Date(raw.start.dateTime ?? '');
  const end = allDay
    ? localMidnight(raw.end.date ?? raw.start.date ?? '')
    : new Date(raw.end.dateTime ?? raw.start.dateTime ?? '');
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return undefined;
  }
  const rawSummary = raw.summary?.trim() || 'Untitled';
  const fullSummary =
    kind === 'birthdays'
      ? withBirthdayAge(rawSummary, raw.description, start)
      : rawSummary;
  const location = textOf(raw.location);
  const description =
    kind && NO_NOTES.has(kind) ? undefined : textOf(raw.description);
  return {
    calendar,
    summary:
      (kind && SUMMARY_FORMATTERS[kind])?.(fullSummary, raw) ?? fullSummary,
    fullSummary,
    ...(location && { location }),
    ...(description && { description }),
    start: start.toISOString(),
    end: end.toISOString(),
    allDay,
  };
};

/** Normalises a whole response, dropping items with no usable times. */
export const normaliseEvents = (
  calendar: string,
  raw: RawCalendarEvent[],
  kind?: CalendarKind,
) =>
  raw
    .map((item) => normaliseEvent(calendar, item, kind))
    .filter((event): event is CalendarEvent => event !== undefined);

/** Local midnight today until `CALENDAR_DAYS` days later: what the store fetches. */
export const calendarWindow = (now: Date = new Date()) => {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + CALENDAR_DAYS);
  return { start, end };
};

/**
 * Events of one calendar between two instants, in HA's REST shape. The URL is
 * relative, so it is same-origin: HA serves the page, and `pnpm dev` proxies
 * `/api` to HA (see `dev-ha.ts`), as HA's REST API refuses the dev origin.
 */
export const fetchCalendarEvents = async (
  auth: Auth,
  entityId: string,
  start: Date,
  end: Date,
): Promise<RawCalendarEvent[]> => {
  const query = new URLSearchParams({
    start: start.toISOString(),
    end: end.toISOString(),
  });
  if (auth.expired) await auth.refreshAccessToken();
  const response = await fetch(`/api/calendars/${entityId}?${query}`, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });
  if (!response.ok) throw new Error(`Calendar ${entityId}: ${response.status}`);
  return (await response.json()) as RawCalendarEvent[];
};

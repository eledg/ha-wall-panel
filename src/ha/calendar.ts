import type { Auth } from 'home-assistant-js-websocket';

import type { EntityKey } from './store.ts';

/** How often calendar events are re-fetched; HA pushes no event when they change. */
export const CALENDAR_REFRESH_MS = 5 * 60_000;

/** Events older than this many missed refreshes are shown as stale. */
export const CALENDAR_STALE_MS = 3 * CALENDAR_REFRESH_MS;

/** How many days ahead of today the store fetches events for. */
export const CALENDAR_DAYS = 7;

/** One calendar event, reduced to what the tile shows. */
export type CalendarEvent = {
  calendar: EntityKey;
  summary: string;
  /** ISO timestamps. An all-day event runs from local midnight to local midnight. */
  start: string;
  end: string;
  allDay: boolean;
};

/** An item from `GET /api/calendars/<entity_id>`, as far as the store reads it. */
export type RawCalendarEvent = {
  summary?: string;
  /** Only read to shorten titles; descriptions are ignored (F1's are ~1.5 KB). */
  location?: string | null;
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

/** Per-calendar tidying of titles that are too long for the tile. */
const SUMMARY_FORMATTERS: Partial<
  Record<EntityKey, (summary: string, raw: RawCalendarEvent) => string>
> = {
  calendarF1: (summary, raw) => shortenF1(summary, raw.location),
};

/**
 * Reduces a REST calendar item to a `CalendarEvent`, or `undefined` when it
 * has no usable times. Timed events carry a UTC offset that can differ between
 * items, so `Date` parses them. All-day `end` dates are exclusive in HA.
 */
export const normaliseEvent = (
  calendar: EntityKey,
  raw: RawCalendarEvent,
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
  const summary = raw.summary?.trim() || 'Untitled';
  return {
    calendar,
    summary: SUMMARY_FORMATTERS[calendar]?.(summary, raw) ?? summary,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay,
  };
};

/** Normalises a whole response, dropping items with no usable times. */
export const normaliseEvents = (calendar: EntityKey, raw: RawCalendarEvent[]) =>
  raw
    .map((item) => normaliseEvent(calendar, item))
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

import type { Auth } from 'home-assistant-js-websocket';

import type { CalendarSource } from '@/config/config.ts';
import { midnightOf, startOfDay } from '@/config/datetime.ts';

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
  /** The title for the tile's rows, rewritten by the calendar's `title` rule, if it has one. */
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

/** A calendar's formatting options, with its title rule compiled. */
export type CalendarFormat = {
  showYears?: boolean;
  hideNotes?: boolean;
  title?: { match: RegExp; replace: string };
};

/** Compiles a calendar's options once, so each event doesn't rebuild the regex. */
export const compileFormat = ({
  showYears,
  hideNotes,
  title,
}: Pick<
  CalendarSource,
  'showYears' | 'hideNotes' | 'title'
>): CalendarFormat => ({
  ...(showYears && { showYears }),
  ...(hideNotes && { hideNotes }),
  ...(title && {
    title: { match: new RegExp(title.match, 'u'), replace: title.replace },
  }),
});

const TITLE_TOKEN = /\$(\d)|\{location\}/gu;

/**
 * Replaces the part of `summary` the rule matches. In `replace`, `$1` to `$9`
 * are the match's groups (`$0` all of it) and `{location}` is the event's
 * location. A title the rule doesn't match, or a rule that needs a location the
 * event lacks, leaves the title as it is.
 */
export const rewriteTitle = (
  summary: string,
  rule: NonNullable<CalendarFormat['title']>,
  location?: string | null,
) => {
  const match = rule.match.exec(summary);
  const place = location?.trim();
  if (!match || (rule.replace.includes('{location}') && !place)) return summary;
  const text = rule.replace.replace(TITLE_TOKEN, (_token, n?: string) =>
    n === undefined ? (place ?? '') : (match[Number(n)] ?? ''),
  );
  return (
    summary.slice(0, match.index) +
    text +
    summary.slice(match.index + match[0].length)
  );
};

/** Trimmed text, or `undefined` when HA sends nothing, `null` or `""`. */
const textOf = (value?: string | null) => value?.trim() || undefined;

// The suffixes are English text, so the rules stay English whatever the locale.
const ordinalRules = new Intl.PluralRules('en', { type: 'ordinal' });
const ORDINAL_SUFFIX = {
  one: 'st',
  two: 'nd',
  few: 'rd',
  other: 'th',
} as const;

/** `1st`, `22nd`, `39th`. */
const ordinal = (n: number) =>
  `${n}${ORDINAL_SUFFIX[ordinalRules.select(n) as keyof typeof ORDINAL_SUFFIX] ?? 'th'}`;

const START_YEAR = /\b((?:19|20)\d{2})\b/u;
const LAST_POSSESSIVE = /^(.*['\u2019]s) (.+)$/u;

/**
 * Adds how many years it has been since the first year in the description.
 * `Alex Example's Birthday` with a description of `Born 1977`, falling in 2026,
 * becomes `Alex Example's 49th Birthday`: the count goes after the last `'s`,
 * or at the start of a title without one (`16th Wedding Anniversary`). Without a
 * year, or if the year isn't before the event's, the title is left as it is.
 */
export const withYears = (
  summary: string,
  description: string | null | undefined,
  eventDate: Date,
) => {
  const since = Number(START_YEAR.exec(description ?? '')?.[1]);
  const years = eventDate.getFullYear() - since;
  if (!Number.isFinite(since) || years < 1) return summary;
  const possessive = LAST_POSSESSIVE.exec(summary);
  return possessive
    ? `${possessive[1]} ${ordinal(years)} ${possessive[2]}`
    : `${ordinal(years)} ${summary}`;
};

/**
 * Reduces a REST calendar item to a `CalendarEvent`, or `undefined` when it
 * has no usable times. Timed events carry a UTC offset that can differ between
 * items, so `Date` parses them. All-day `end` dates are exclusive in HA.
 */
export const normaliseEvent = (
  calendar: string,
  raw: RawCalendarEvent,
  format: CalendarFormat = {},
): CalendarEvent | undefined => {
  const allDay = raw.start.date !== undefined;
  const start = allDay
    ? midnightOf(raw.start.date ?? '')
    : new Date(raw.start.dateTime ?? '');
  const end = allDay
    ? midnightOf(raw.end.date ?? raw.start.date ?? '')
    : new Date(raw.end.dateTime ?? raw.start.dateTime ?? '');
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return undefined;
  }
  const rawSummary = raw.summary?.trim() || 'Untitled';
  const fullSummary = format.showYears
    ? withYears(rawSummary, raw.description, start)
    : rawSummary;
  const location = textOf(raw.location);
  const description = format.hideNotes ? undefined : textOf(raw.description);
  return {
    calendar,
    summary: format.title
      ? rewriteTitle(fullSummary, format.title, raw.location)
      : fullSummary,
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
  format?: CalendarFormat,
) =>
  raw
    .map((item) => normaliseEvent(calendar, item, format))
    .filter((event): event is CalendarEvent => event !== undefined);

/** Midnight today in the configured zone until `CALENDAR_DAYS` days later: what the store fetches. */
export const calendarWindow = (now: Date = new Date()) => ({
  start: startOfDay(now),
  end: startOfDay(now, CALENDAR_DAYS),
});

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

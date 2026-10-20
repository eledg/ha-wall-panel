import type { HassEntity } from 'home-assistant-js-websocket';
import { useCallback, useState } from 'preact/hooks';

import { AlertIcon } from '@/components/icons/alert-icon.tsx';
import { EventSheet } from '@/components/sheets/event-sheet.tsx';
import type { TileConfig } from '@/config/config.ts';
import { useMinute } from '@/hooks/use-minute.ts';
import { useSnapshot } from '@/hooks/use-snapshot.ts';
import {
  COLOR_CLASSES,
  dayLabel,
  FALLBACK,
  meta,
  midnight,
  shortDay,
} from '@/lib/calendar-labels.ts';
import { formatTime } from '@/lib/format.ts';
import { CALENDAR_STALE_MS } from '@/services/ha/calendar.ts';
import type { CalendarEvent } from '@/services/ha/calendar.ts';
import { haStore } from '@/services/ha/instance.ts';
import type { HaSnapshot, HaStore } from '@/services/ha/store.ts';

import { Tile, Unavailable } from './base/tile.tsx';
import type { TileState } from './base/tile.tsx';

const MAX_ROWS = 4;

/**
 * Splits events into the highlighted "next" one and up to four more rows, as
 * the design does. HA returns events in no particular order, so they are
 * sorted here; events that have finished are dropped.
 */
export const buildAgenda = (events: CalendarEvent[], now: Date) => {
  const live = events
    .filter((event) => new Date(event.end) > now)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const tomorrow = midnight(now, 1);
  const today = live.filter((event) => new Date(event.start) < tomorrow);
  const later = live.filter((event) => new Date(event.start) >= tomorrow);
  const next = today.find((event) => !event.allDay) ?? today[0];
  const rest = [...today.filter((event) => event !== next), ...later].slice(
    0,
    MAX_ROWS,
  );
  return { next, rest };
};

/** What the tile shows, from which calendars exist, have loaded, are healthy and are fresh. */
const calendarTileState = ({
  hasStaleEvents,
  isOffline,
  hasLoadedEvents,
  lastFetchFailed,
  presentCalendars,
  anyCalendarHealthy,
}: {
  /** Some calendar's cached events are older than `CALENDAR_STALE_MS`. */
  hasStaleEvents: boolean;
  /** The connection to HA is down. */
  isOffline: boolean;
  /** At least one present calendar has events (possibly cached). */
  hasLoadedEvents: boolean;
  /** The last events fetch failed. */
  lastFetchFailed: boolean;
  /** How many configured calendars have an entity in HA. */
  presentCalendars: number;
  /** At least one present calendar is neither `unavailable` nor `unknown`. */
  anyCalendarHealthy: boolean;
}): TileState => {
  if (presentCalendars === 0) return isOffline ? 'loading' : 'unavailable';
  if (!hasLoadedEvents) {
    return lastFetchFailed || !anyCalendarHealthy ? 'unavailable' : 'loading';
  }
  return hasStaleEvents ? 'stale' : 'normal'; // Tile also turns it stale while offline
};

/**
 * Today's next event and what follows, from the tile's calendars. If a refresh
 * fails the last events stay on screen.
 */
export const CalendarTile = ({
  tile,
  store = haStore,
  now,
}: {
  tile: TileConfig<'calendar'>;
  store?: HaStore;
  now?: () => Date;
}) => {
  const sources = tile.calendars;
  const ids = sources.map((source) => source.entity);
  // Only the calendar entities, so a light or weather update does not redraw.
  const [status, calendars, calendarUpdated, calendarFailed, ...found] =
    useSnapshot(store, (s) => [
      s.status,
      s.calendars,
      s.calendarUpdated,
      s.calendarFailed,
      ...ids.map((id) => s.entities[id]),
    ]) as [
      HaSnapshot['status'],
      HaSnapshot['calendars'],
      HaSnapshot['calendarUpdated'],
      boolean,
      ...(HassEntity | undefined)[],
    ];
  const entities = Object.fromEntries(
    ids.map((id, i) => [id, found[i]]),
  ) as Partial<Record<string, HassEntity>>;
  const current = useMinute(now);
  const [open, setOpen] = useState<CalendarEvent>();
  const close = useCallback(() => setOpen(undefined), []);
  const offline = status !== 'connected';

  // A missing entity is a config error, so its calendar is left out. An
  // unavailable one is usually transient (HA reloading an integration), so its
  // cached events stay on screen. Either is flagged in the legend.
  const present = ids.filter((id) => entities[id] !== undefined);
  const healthy = (key: string) =>
    present.includes(key) &&
    entities[key]?.state !== 'unavailable' &&
    entities[key]?.state !== 'unknown';
  const loaded = present.some((key) => calendars[key] !== undefined);
  // Cached events are kept when refreshes fail, so say when they are old.
  const old = present.some((key) => {
    const updated = calendarUpdated[key];
    return (
      updated !== undefined && current.getTime() - updated > CALENDAR_STALE_MS
    );
  });

  const state = calendarTileState({
    hasStaleEvents: old,
    isOffline: offline,
    hasLoadedEvents: loaded,
    lastFetchFailed: calendarFailed,
    presentCalendars: present.length,
    anyCalendarHealthy: present.some(healthy),
  });

  // Beside the tile, not inside it, so the tile's stale dimming and clipping
  // never touch the sheet. It keeps the event it was opened with.
  const sheet = open && (
    <EventSheet
      event={open}
      calendar={meta(sources, open.calendar)}
      onClose={close}
      now={now}
    />
  );

  if (state === 'loading') {
    return (
      <>
        <Tile place={tile} state="loading" />
        {sheet}
      </>
    );
  }
  if (state === 'unavailable') {
    return (
      <>
        <Tile place={tile} state="unavailable">
          <div class="flex h-full flex-col justify-center gap-1">
            <Unavailable label="Calendar unavailable" />
            <div class="text-sm text-fg-dim">
              {present.length === 0
                ? 'Check entity config'
                : 'Will retry automatically'}
            </div>
          </div>
        </Tile>
        {sheet}
      </>
    );
  }

  const events = present.flatMap((key) => calendars[key] ?? []);
  const { next, rest } = buildAgenda(events, current);
  const nextMeta = next ? meta(sources, next.calendar) : FALLBACK;
  return (
    <>
      <Tile place={tile} state={state}>
        <div class="flex h-full flex-col gap-3">
          <div class="flex items-baseline justify-between">
            <span class="text-sm font-medium tracking-wider text-fg-dim uppercase">
              Today
            </span>
            <div class="flex gap-3">
              {sources.map(({ entity: key, label, color }) => {
                const { bar } = COLOR_CLASSES[color];
                const missing = !healthy(key);
                return (
                  <span
                    key={key}
                    class={`flex items-center gap-1 text-[11px] ${missing ? 'text-warn' : 'text-fg-dim'}`}
                  >
                    {missing ? (
                      <AlertIcon class="size-3" />
                    ) : (
                      <span class={`h-2 w-2 rounded-full ${bar}`} />
                    )}
                    {label || key}
                  </span>
                );
              })}
            </div>
          </div>
          {next ? (
            <button
              type="button"
              class="tap relative block w-full rounded-xl bg-surface-2 py-3 pr-3 pl-[1.875rem] text-left"
              onClick={() => setOpen(next)}
            >
              {/* Absolutely placed: the display left an empty stretched flex item in a
                  button at zero height (see docs/display.md). */}
              <span
                class={`absolute inset-y-3 left-3 w-1.5 rounded-full ${nextMeta.bar}`}
              />
              <div class="min-w-0">
                <div class="tnum text-xl font-semibold text-fg">
                  {next.allDay ? 'All day' : formatTime(new Date(next.start))}
                  <span class={`ml-2 text-xs font-medium ${nextMeta.text}`}>
                    {nextMeta.label}
                  </span>
                </div>
                <div class="line-clamp-2 text-lg leading-snug">
                  {next.summary}
                </div>
              </div>
            </button>
          ) : (
            <div class="rounded-xl bg-surface-2 p-3 text-xl text-fg-dim">
              Nothing today
            </div>
          )}
          <ul class="flex min-h-0 flex-col gap-1.5 overflow-hidden">
            {rest.map((event) => {
              const start = new Date(event.start);
              const label = dayLabel(start, current);
              return (
                <li
                  key={`${event.calendar}${event.start}${event.summary}`}
                  class="min-w-0"
                >
                  <button
                    type="button"
                    class="tap flex w-full min-w-0 items-center gap-2.5 rounded-lg bg-surface text-left text-base"
                    onClick={() => setOpen(event)}
                  >
                    <span
                      class={`h-2.5 w-2.5 shrink-0 rounded-full ${meta(sources, event.calendar).bar}`}
                    />
                    <span class="tnum w-[7.5rem] shrink-0 truncate text-fg-dim">
                      {label === 'Today' ? '' : `${shortDay(label)} `}
                      {event.allDay ? 'all day' : formatTime(start)}
                    </span>
                    <span class="min-w-0 truncate">{event.summary}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </Tile>
      {sheet}
    </>
  );
};

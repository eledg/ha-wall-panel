import { useCallback, useState } from 'preact/hooks';

import { formatTime } from '../format.ts';
import type { GridArea } from '../grid.ts';
import {
  CALENDARS,
  dayLabel,
  FALLBACK,
  meta,
  midnight,
  shortDay,
} from './calendar-labels.ts';
import { useMinute } from './clock-tile.tsx';
import { EventSheet } from './event-sheet.tsx';
import { Tile, Unavailable } from './tile.tsx';
import type { TileState } from './tile.tsx';
import { CALENDAR_STALE_MS } from '../ha/calendar.ts';
import type { CalendarEvent } from '../ha/calendar.ts';
import { haStore } from '../ha/instance.ts';
import type { EntityKey, HaStore } from '../ha/store.ts';
import { useSnapshot } from '../ha/use-snapshot.ts';
import { AlertIcon } from '../icons/alert-icon.tsx';

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

/**
 * Today's next event and what follows, from the Family, F1 and Birthdays
 * calendars. If a refresh fails the last events stay on screen.
 */
export const CalendarTile = ({
  area,
  store = haStore,
  now,
}: {
  area: GridArea;
  store?: HaStore;
  now?: () => Date;
}) => {
  const { status, entities, calendars, calendarUpdated, calendarFailed } =
    useSnapshot(store);
  const current = useMinute(now);
  const [open, setOpen] = useState<CalendarEvent>();
  const close = useCallback(() => setOpen(undefined), []);
  const offline = status !== 'connected';

  // A missing entity is a config error, so its calendar is left out. An
  // unavailable one is usually transient (HA reloading an integration), so its
  // cached events stay on screen. Either is flagged in the legend.
  const keys = Object.keys(CALENDARS) as EntityKey[];
  const present = keys.filter((key) => entities[key] !== undefined);
  const healthy = (key: EntityKey) =>
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

  let state: TileState = old ? 'stale' : 'normal'; // Tile also turns it stale while offline
  if (present.length === 0) state = offline ? 'loading' : 'unavailable';
  else if (!loaded) {
    state =
      calendarFailed || present.every((key) => !healthy(key))
        ? 'unavailable'
        : 'loading';
  }

  // Beside the tile, not inside it, so the tile's stale dimming and clipping
  // never touch the sheet. It keeps the event it was opened with.
  const sheet = open && <EventSheet event={open} onClose={close} now={now} />;

  if (state === 'loading') {
    return (
      <>
        <Tile area={area} state="loading" />
        {sheet}
      </>
    );
  }
  if (state === 'unavailable') {
    return (
      <>
        <Tile area={area} state="unavailable">
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
  const nextMeta = next ? meta(next.calendar) : FALLBACK;
  return (
    <>
      <Tile area={area} state={state}>
        <div class="flex h-full flex-col gap-3">
          <div class="flex items-baseline justify-between">
            <span class="text-sm font-medium tracking-wider text-fg-dim uppercase">
              Today
            </span>
            <div class="flex gap-3">
              {keys.map((key) => {
                const { label, bar } = CALENDARS[key]!;
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
                    {label}
                  </span>
                );
              })}
            </div>
          </div>
          {next ? (
            <button
              type="button"
              class="tap flex w-full gap-3 rounded-xl bg-surface-2 p-3 text-left"
              onClick={() => setOpen(next)}
            >
              <span class={`w-1.5 shrink-0 rounded-full ${nextMeta.bar}`} />
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
                      class={`h-2.5 w-2.5 shrink-0 rounded-full ${meta(event.calendar).bar}`}
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

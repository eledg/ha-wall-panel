// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HaConnection } from '@/components/layout/ha-connection.tsx';
import { createMockHa } from '@/dev/mock/engine.ts';
import { dayLabel, shortDay } from '@/lib/calendar-labels.ts';
import { CALENDAR_STALE_MS } from '@/services/ha/calendar.ts';
import type { CalendarEvent } from '@/services/ha/calendar.ts';
import { createHaStore } from '@/services/ha/store.ts';
import type { HaStore } from '@/services/ha/store.ts';
import { entityId, tileOf } from '@/tests/ids.ts';

import { buildAgenda, CalendarTile } from './calendar-tile.tsx';

const text = () => document.body.textContent;
afterEach(() => render(null, document.body));

const NOW = new Date(2026, 9, 10, 12, 0); // Sat 10 Oct 2026, 12:00 local

const timed = (
  summary: string,
  day: number,
  hour: number,
  calendar: CalendarEvent['calendar'] = entityId('calendarFamily'),
): CalendarEvent => ({
  calendar,
  summary,
  fullSummary: summary,
  start: new Date(2026, 9, day, hour).toISOString(),
  end: new Date(2026, 9, day, hour + 1).toISOString(),
  allDay: false,
});

const allDay = (summary: string, day: number, days = 1): CalendarEvent => ({
  calendar: entityId('calendarBirthdays'),
  summary,
  fullSummary: summary,
  start: new Date(2026, 9, day).toISOString(),
  end: new Date(2026, 9, day + days).toISOString(),
  allDay: true,
});

describe('dayLabel', () => {
  it('says Today, Tmrw, then the weekday', () => {
    expect(dayLabel(new Date(2026, 9, 10, 18), NOW)).toBe('Today');
    expect(dayLabel(new Date(2026, 9, 11, 0), NOW)).toBe('Tmrw');
    expect(dayLabel(new Date(2026, 9, 13, 9), NOW)).toBe('Tuesday');
  });

  it('counts an event that began earlier as today', () => {
    expect(dayLabel(new Date(2026, 9, 8), NOW)).toBe('Today');
  });
});

describe('shortDay', () => {
  it('shortens weekdays but keeps Tmrw whole', () => {
    expect(shortDay('Tmrw')).toBe('Tmrw');
    expect(shortDay('Monday')).toBe('Mon');
  });
});

describe('buildAgenda', () => {
  it('sorts events HA returned out of order', () => {
    const { next, rest } = buildAgenda(
      [timed('c', 13, 9), timed('b', 11, 9), timed('a', 10, 15)],
      NOW,
    );

    expect(next?.summary).toBe('a');
    expect(rest.map((e) => e.summary)).toEqual(['b', 'c']);
  });

  it('drops finished events', () => {
    const { next } = buildAgenda([timed('done', 10, 9)], NOW);

    expect(next).toBeUndefined();
  });

  it('prefers a timed event today over an all-day one', () => {
    const { next, rest } = buildAgenda(
      [allDay('Birthday', 10), timed('Dentist', 10, 15)],
      NOW,
    );

    expect(next?.summary).toBe('Dentist');
    expect(rest.map((e) => e.summary)).toEqual(['Birthday']);
  });

  it('features an all-day event when it is the only thing today', () => {
    const { next } = buildAgenda([allDay('Inset day', 10)], NOW);

    expect(next?.summary).toBe('Inset day');
  });

  it('keeps an all-day event that began earlier and is still running', () => {
    const { next } = buildAgenda([allDay('Away', 8, 4)], NOW);

    expect(next?.summary).toBe('Away');
  });

  it('has no next event on an empty day, but lists what follows', () => {
    const { next, rest } = buildAgenda([timed('Later', 12, 9)], NOW);

    expect(next).toBeUndefined();
    expect(rest).toHaveLength(1);
  });

  it('shows at most four more rows', () => {
    const events = [10, 11, 12, 13, 14, 15, 16].map((d) =>
      timed(`e${d}`, d, 15),
    );

    expect(buildAgenda(events, NOW).rest).toHaveLength(4);
  });
});

const setup = async () => {
  const mock = createMockHa();
  const store = createHaStore(mock.deps);
  await act(async () => {
    await store.start(mock.getAuth);
    render(
      <HaConnection store={store}>
        <CalendarTile tile={tileOf('calendar')} store={store} />
      </HaConnection>,
      document.body,
    );
  });
  await act(async () => {
    await vi.waitFor(() =>
      expect(Object.keys(store.getSnapshot().calendars)).toHaveLength(3),
    );
  });
  return { mock, store };
};

describe('CalendarTile', () => {
  it('shows the next event, the legend and upcoming rows', async () => {
    await setup();

    expect(text()).toContain('Today');
    expect(text()).toContain('Family');
    expect(text()).toContain('Birthdays');
    expect(text()).toContain('Alex');
    expect(text()).toContain('Football practice');
  });

  it('says Nothing today and still lists later events', async () => {
    const { mock } = await setup();

    await act(async () => mock.controls.setCalendar('empty'));

    await vi.waitFor(() => expect(text()).toContain('Nothing today'));
    expect(text()).toContain('Qualifying');
  });

  it('renders all-day events', async () => {
    const { mock } = await setup();

    await act(async () => mock.controls.setCalendar('allday'));

    await vi.waitFor(() => expect(text()).toContain('All day'));
    expect(text()).toContain('School inset day');
  });

  it('keeps showing events when a refresh fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { mock, store } = await setup();

    await act(async () => {
      mock.controls.failCalendar(true);
      mock.controls.setCalendar('busy'); // touches entities, so a refetch fails
    });

    await vi.waitFor(() => expect(console.error).toHaveBeenCalled());
    expect(text()).toContain('Alex');
    expect(text()).not.toContain('Calendar unavailable');
    expect(store.getSnapshot().calendarFailed).toBe(false);
  });

  it('says unavailable when no events ever loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const mock = createMockHa();
    mock.controls.failCalendar(true);
    const store = createHaStore(mock.deps);
    await act(async () => {
      await store.start(mock.getAuth);
      render(
        <CalendarTile tile={tileOf('calendar')} store={store} />,
        document.body,
      );
    });

    await vi.waitFor(() => expect(text()).toContain('Calendar unavailable'));
  });

  const family = entityId('calendarFamily');
  const all = [family, entityId('calendarF1'), entityId('calendarBirthdays')];

  it('leaves out a calendar whose entity is missing, and restores it', async () => {
    const { mock } = await setup();
    expect(text()).toContain('Football practice');

    await act(async () => mock.controls.removeEntity(family));

    expect(text()).not.toContain('Football practice');
    expect(text()).toContain("Alex's Birthday");
    // Its legend entry turns into a warning.
    expect(document.querySelectorAll('.text-warn')).toHaveLength(1);

    await act(async () => mock.controls.setCalendar('normal'));

    await vi.waitFor(() => expect(text()).toContain('Football practice'));
    expect(document.querySelectorAll('.text-warn')).toHaveLength(0);
  });

  it('keeps the cached events of an unavailable calendar, and flags it', async () => {
    const { mock } = await setup();

    await act(async () => mock.controls.setUnavailable(family));

    expect(text()).toContain('Football practice');
    expect(document.querySelectorAll('.text-warn')).toHaveLength(1);

    await act(async () => mock.controls.setCalendar('normal'));

    await vi.waitFor(() =>
      expect(document.querySelectorAll('.text-warn')).toHaveLength(0),
    );
  });

  it('marks cached events stale once refreshes have been missed', async () => {
    const { store } = await setup();
    const withAge = (ageMs: number): HaStore => ({
      ...store,
      getSnapshot: () => ({
        ...store.getSnapshot(),
        calendarUpdated: {
          [entityId('calendarFamily')]: Date.now() - ageMs,
          [entityId('calendarF1')]: Date.now() - ageMs,
          [entityId('calendarBirthdays')]: Date.now() - ageMs,
        },
      }),
    });
    const show = (fake: HaStore) =>
      act(() => {
        render(null, document.body);
        render(
          <CalendarTile tile={tileOf('calendar')} store={fake} />,
          document.body,
        );
      });

    await show(withAge(CALENDAR_STALE_MS - 60_000));
    expect(text()).not.toContain('stale');

    await show(withAge(CALENDAR_STALE_MS + 60_000));
    expect(text()).toContain('stale');
    expect(text()).toContain('Football practice');
  });

  it('says to check the config when every calendar is missing', async () => {
    const { mock } = await setup();

    await act(async () => all.forEach((id) => mock.controls.removeEntity(id)));

    expect(text()).toContain('Calendar unavailable');
    expect(text()).toContain('Check entity config');

    await act(async () => mock.controls.setCalendar('normal'));

    await vi.waitFor(() => expect(text()).toContain('Football practice'));
  });

  const open = (label: string) =>
    act(() => {
      [...document.querySelectorAll('button')]
        .find((b) => b.textContent?.includes(label))!
        .click();
    });
  const dialog = () => document.querySelector('dialog');

  it('opens the details of a row, with its location and notes', async () => {
    await setup();

    await open('Football practice');

    expect(dialog()?.textContent).toContain('Football practice');
    expect(dialog()?.textContent).toContain('Recreation ground, main pitch');
    expect(dialog()?.textContent).toContain('Meet at the pavilion');
  });

  it('opens the next event from the highlighted card', async () => {
    const { mock } = await setup();
    // All-day only: the next event is always one that is under way today.
    await act(async () => mock.controls.setCalendar('allday'));
    await vi.waitFor(() => expect(text()).toContain('All day'));

    await open('All day');

    expect(dialog()?.textContent).toContain('Friends staying (3 days)');
    expect(dialog()?.textContent).toContain('3 days');
  });

  it('shows the full F1 title in the details, and no promotional notes', async () => {
    await setup();
    expect(text()).toContain('F1 Singapore - Race');

    await open('F1 Singapore - Race');

    expect(dialog()?.querySelector('h2')?.textContent).toMatch(
      /^.+ FORMULA 1 SINGAPORE AIRLINES SINGAPORE GRAND PRIX 2026 - Race$/u,
    );
    expect(dialog()?.textContent).toContain('Singapore');
    expect(dialog()?.textContent).not.toContain('Notes');
    expect(dialog()?.textContent).not.toContain('Race Hub');
  });

  it('closes the details, and does not dim the sheet when stale', async () => {
    const { mock } = await setup();
    await open('Football practice');

    await act(async () => mock.controls.setConnected(false));

    expect(text()).toContain('stale');
    expect(dialog()?.closest('.opacity-60')).toBeNull();

    await act(() => {
      document
        .querySelector<HTMLButtonElement>('button[aria-label=Close]')!
        .click();
    });

    expect(dialog()).toBeNull();
  });

  it('dims as stale while disconnected', async () => {
    const { mock } = await setup();

    await act(async () => mock.controls.setConnected(false));

    expect(text()).toContain('stale');
    expect(text()).toContain('Alex');
  });
});

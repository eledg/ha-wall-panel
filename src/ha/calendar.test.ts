import { describe, expect, it } from 'vitest';

import {
  CALENDAR_DAYS,
  calendarWindow,
  normaliseEvent,
  normaliseEvents,
} from './calendar.ts';

describe('normaliseEvent', () => {
  it('reads a timed event and parses its offset', () => {
    const event = normaliseEvent('calendarFamily', {
      summary: 'Dentist',
      description: 'ignored',
      location: 'ignored',
      start: { dateTime: '2026-10-10T10:00:00+01:00' },
      end: { dateTime: '2026-10-10T10:30:00+01:00' },
    } as Parameters<typeof normaliseEvent>[1]);

    expect(event).toEqual({
      calendar: 'calendarFamily',
      summary: 'Dentist',
      start: '2026-10-10T09:00:00.000Z',
      end: '2026-10-10T09:30:00.000Z',
      allDay: false,
    });
  });

  it('reads events with differing offsets as the same instant', () => {
    const a = normaliseEvent('calendarF1', {
      summary: 'a',
      start: { dateTime: '2026-10-25T20:00:00+00:00' },
      end: { dateTime: '2026-10-25T21:00:00+00:00' },
    });
    const b = normaliseEvent('calendarF1', {
      summary: 'b',
      start: { dateTime: '2026-10-25T21:00:00+01:00' },
      end: { dateTime: '2026-10-25T22:00:00+01:00' },
    });

    expect(a?.start).toBe(b?.start);
  });

  it('reads an all-day event as local midnight to local midnight', () => {
    const event = normaliseEvent('calendarBirthdays', {
      summary: 'Birthday',
      start: { date: '2026-10-12' },
      end: { date: '2026-10-13' },
    });

    expect(event?.allDay).toBe(true);
    expect(new Date(event!.start)).toEqual(new Date(2026, 9, 12));
    expect(new Date(event!.end)).toEqual(new Date(2026, 9, 13));
  });

  it('names an event without a summary and drops one without times', () => {
    expect(
      normaliseEvent('calendarFamily', {
        start: { date: '2026-10-12' },
        end: { date: '2026-10-13' },
      })?.summary,
    ).toBe('Untitled');
    expect(
      normaliseEvent('calendarFamily', { summary: 'x', start: {}, end: {} }),
    ).toBeUndefined();
  });
});

describe('normaliseEvents', () => {
  it('drops items with no usable times and keeps the rest', () => {
    const events = normaliseEvents('calendarFamily', [
      { summary: 'bad', start: {}, end: {} },
      {
        summary: 'Dentist',
        start: { dateTime: '2026-10-10T10:00:00+01:00' },
        end: { dateTime: '2026-10-10T10:30:00+01:00' },
      },
    ]);

    expect(events.map((event) => event.summary)).toEqual(['Dentist']);
  });
});

describe('calendarWindow', () => {
  it('runs from local midnight today for CALENDAR_DAYS days', () => {
    const { start, end } = calendarWindow(new Date(2026, 9, 10, 15, 42));

    expect(start).toEqual(new Date(2026, 9, 10));
    expect(end).toEqual(new Date(2026, 9, 10 + CALENDAR_DAYS));
  });
});

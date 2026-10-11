import { describe, expect, it } from 'vitest';

import {
  CALENDAR_DAYS,
  calendarWindow,
  normaliseEvent,
  normaliseEvents,
  shortenF1,
} from './calendar.ts';

describe('normaliseEvent', () => {
  it('reads a timed event and parses its offset', () => {
    const event = normaliseEvent('calendarFamily', {
      summary: 'Dentist',
      location: 'High Street',
      description: 'Check in early',
      start: { dateTime: '2026-10-10T10:00:00+01:00' },
      end: { dateTime: '2026-10-10T10:30:00+01:00' },
    });

    expect(event).toEqual({
      calendar: 'calendarFamily',
      summary: 'Dentist',
      fullSummary: 'Dentist',
      location: 'High Street',
      description: 'Check in early',
      start: '2026-10-10T09:00:00.000Z',
      end: '2026-10-10T09:30:00.000Z',
      allDay: false,
    });
  });

  it.each([undefined, null, '', '   '])(
    'leaves out a location and description of %j',
    (empty) => {
      const event = normaliseEvent('calendarFamily', {
        summary: 'Dentist',
        location: empty,
        description: empty,
        start: { dateTime: '2026-10-10T10:00:00+01:00' },
        end: { dateTime: '2026-10-10T10:30:00+01:00' },
      });

      expect(event).not.toHaveProperty('location');
      expect(event).not.toHaveProperty('description');
    },
  );

  it('trims the location and description', () => {
    const event = normaliseEvent('calendarFamily', {
      summary: 'Dentist',
      location: '  High Street ',
      description: '\nCheck in early\n',
      start: { date: '2026-10-10' },
      end: { date: '2026-10-11' },
    });

    expect(event?.location).toBe('High Street');
    expect(event?.description).toBe('Check in early');
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

describe('shortenF1', () => {
  const title = (emoji: string, gp: string, session: string) =>
    `${emoji} FORMULA 1 ${gp} 2026 - ${session}`;

  it.each([
    ['🏁', 'SINGAPORE AIRLINES SINGAPORE GRAND PRIX', 'Singapore', 'Race'],
    [
      '🏎',
      'MSC CRUISES UNITED STATES GRAND PRIX',
      'United States',
      'Practice 1',
    ],
    ['⏱️', 'QATAR AIRWAYS AZERBAIJAN GRAND PRIX', 'Azerbaijan', 'Qualifying'],
    [
      '🏁',
      'SINGAPORE AIRLINES SINGAPORE GRAND PRIX',
      'Singapore',
      'Sprint Race',
    ],
    [
      '⏱️',
      'GRAN PREMIO DE LA CIUDAD DE MÉXICO',
      'Mexico',
      'Sprint Qualification',
    ],
    [
      '🏎',
      'ETIHAD AIRWAYS ABU DHABI GRAND PRIX',
      'United Arab Emirates',
      'Practice 3',
    ],
  ])('shortens %s %s', (emoji, gp, location, session) => {
    expect(shortenF1(title(emoji, gp, session), location)).toBe(
      `${emoji} F1 ${location} - ${session}`,
    );
  });

  it('keeps the emoji exactly, including a variation selector', () => {
    expect(shortenF1(title('⏱️', 'X GRAND PRIX', 'Race'), 'Place')).toMatch(
      /^⏱️ F1 /u,
    );
  });

  it('uses the last " - " for the session', () => {
    expect(
      shortenF1('🏁 FORMULA 1 A - B GRAND PRIX 2026 - Race', 'Place'),
    ).toBe('🏁 F1 Place - Race');
  });

  it('leaves the title alone without a location', () => {
    const original = title('🏁', 'SINGAPORE GRAND PRIX', 'Race');
    expect(shortenF1(original, undefined)).toBe(original);
    expect(shortenF1(original, null)).toBe(original);
    expect(shortenF1(original, '  ')).toBe(original);
  });

  it('leaves a title that is not an F1 session alone', () => {
    expect(shortenF1('Dinner - with friends', 'Place')).toBe(
      'Dinner - with friends',
    );
    expect(shortenF1('🏁 FORMULA 1 SINGAPORE GRAND PRIX 2026', 'Place')).toBe(
      '🏁 FORMULA 1 SINGAPORE GRAND PRIX 2026',
    );
  });
});

describe('normaliseEvent, F1 titles', () => {
  const raw = {
    summary: '🏁 FORMULA 1 SINGAPORE AIRLINES SINGAPORE GRAND PRIX 2026 - Race',
    location: 'Singapore',
    start: { dateTime: '2026-10-11T13:00:00+01:00' },
    end: { dateTime: '2026-10-11T15:00:00+01:00' },
  };

  it('keeps the full title for the detail view, and the location', () => {
    const event = normaliseEvent('calendarF1', raw);

    expect(event?.fullSummary).toBe(raw.summary);
    expect(event?.location).toBe('Singapore');
  });

  it('drops the F1 promotional description but not other calendars', () => {
    const withNotes = { ...raw, description: 'Follow all the action on F1 TV' };

    expect(normaliseEvent('calendarF1', withNotes)).not.toHaveProperty(
      'description',
    );
    expect(normaliseEvent('calendarFamily', withNotes)?.description).toBe(
      'Follow all the action on F1 TV',
    );
  });

  it('shortens titles on the F1 calendar only', () => {
    expect(normaliseEvent('calendarF1', raw)?.summary).toBe(
      '🏁 F1 Singapore - Race',
    );
    expect(normaliseEvent('calendarFamily', raw)?.summary).toBe(raw.summary);
  });
});

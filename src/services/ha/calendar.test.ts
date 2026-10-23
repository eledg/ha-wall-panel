import { describe, expect, it } from 'vitest';

import {
  CALENDAR_DAYS,
  calendarWindow,
  compileFormat,
  normaliseEvent,
  normaliseEvents,
  rewriteTitle,
  withYears,
} from './calendar.ts';

/** The F1 recipe from `config.example.jsonc`. */
const f1 = compileFormat({
  hideNotes: true,
  title: {
    match: String.raw`^(\S+)\s+FORMULA 1\s.*\s-\s(.+)$`,
    replace: '$1 F1 {location} - $2',
  },
});
const showYears = compileFormat({ showYears: true });

describe('normaliseEvent', () => {
  it('reads a timed event and parses its offset', () => {
    const event = normaliseEvent('calendar.family', {
      summary: 'Dentist',
      location: 'High Street',
      description: 'Check in early',
      start: { dateTime: '2026-10-10T10:00:00+01:00' },
      end: { dateTime: '2026-10-10T10:30:00+01:00' },
    });

    expect(event).toEqual({
      calendar: 'calendar.family',
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
      const event = normaliseEvent('calendar.family', {
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
    const event = normaliseEvent('calendar.family', {
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
    const a = normaliseEvent(
      'calendar.f1',
      {
        summary: 'a',
        start: { dateTime: '2026-10-25T20:00:00+00:00' },
        end: { dateTime: '2026-10-25T21:00:00+00:00' },
      },
      f1,
    );
    const b = normaliseEvent(
      'calendar.f1',
      {
        summary: 'b',
        start: { dateTime: '2026-10-25T21:00:00+01:00' },
        end: { dateTime: '2026-10-25T22:00:00+01:00' },
      },
      f1,
    );

    expect(a?.start).toBe(b?.start);
  });

  it('reads an all-day event as local midnight to local midnight', () => {
    const event = normaliseEvent(
      'calendar.birthdays',
      {
        summary: 'Birthday',
        start: { date: '2026-10-12' },
        end: { date: '2026-10-13' },
      },
      showYears,
    );

    expect(event?.allDay).toBe(true);
    expect(new Date(event!.start)).toEqual(new Date(2026, 9, 12));
    expect(new Date(event!.end)).toEqual(new Date(2026, 9, 13));
  });

  it('adds the age to a birthday when the description gives a birth year', () => {
    const birthday = (summary: string, description: string) =>
      normaliseEvent(
        'calendar.birthdays',
        {
          summary,
          description,
          start: { date: '2026-10-14' },
          end: { date: '2026-10-15' },
        },
        showYears,
      );

    expect(birthday("Alex Example's Birthday", 'Born 1977')?.summary).toBe(
      "Alex Example's 49th Birthday",
    );
    expect(birthday('Jo Example’s Birthday', 'Born 2009')?.fullSummary).toBe(
      'Jo Example’s 17th Birthday',
    );
    expect(birthday("Sam's Birthday", 'Born 2004')?.summary).toBe(
      "Sam's 22nd Birthday",
    );
    expect(birthday("Pat Example's Birthday", '')?.summary).toBe(
      "Pat Example's Birthday",
    );
    expect(birthday("Anna's Birthday", 'Born 2026')?.summary).toBe(
      "Anna's Birthday",
    );
  });

  it('counts years for anything with a year in its notes, not only birthdays', () => {
    const years = (summary: string, description: string | undefined) =>
      withYears(summary, description, new Date(2026, 5, 1));

    expect(years('Wedding Anniversary', 'Married 2010')).toBe(
      '16th Wedding Anniversary',
    );
    expect(years("Alex & Jo's Wedding Anniversary", 'Since 2010')).toBe(
      "Alex & Jo's 16th Wedding Anniversary",
    );
    expect(years("Alex's Mum's Birthday", 'Born 1956')).toBe(
      "Alex's Mum's 70th Birthday",
    );
    expect(years("Sam's Birthday Party", 'Born 2016')).toBe(
      "Sam's 10th Birthday Party",
    );
    expect(years('Wedding Anniversary', undefined)).toBe('Wedding Anniversary');
    expect(years('Wedding Anniversary', 'Booked for the weekend')).toBe(
      'Wedding Anniversary',
    );
    expect(years('Wedding Anniversary', 'Married 2027')).toBe(
      'Wedding Anniversary',
    );
    expect(years('Wedding Anniversary', 'Room 12345')).toBe(
      'Wedding Anniversary',
    );
  });

  it('picks the right ordinal suffix', () => {
    const age = (years: number) =>
      withYears("Sam's Birthday", `Born ${2026 - years}`, new Date(2026, 5, 1));

    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(age)).toEqual([
      "Sam's 1st Birthday",
      "Sam's 2nd Birthday",
      "Sam's 3rd Birthday",
      "Sam's 4th Birthday",
      "Sam's 11th Birthday",
      "Sam's 12th Birthday",
      "Sam's 13th Birthday",
      "Sam's 21st Birthday",
      "Sam's 22nd Birthday",
      "Sam's 23rd Birthday",
      "Sam's 101st Birthday",
      "Sam's 111th Birthday",
    ]);
  });

  it('names an event without a summary and drops one without times', () => {
    expect(
      normaliseEvent('calendar.family', {
        start: { date: '2026-10-12' },
        end: { date: '2026-10-13' },
      })?.summary,
    ).toBe('Untitled');
    expect(
      normaliseEvent('calendar.family', { summary: 'x', start: {}, end: {} }),
    ).toBeUndefined();
  });
});

describe('normaliseEvents', () => {
  it('drops items with no usable times and keeps the rest', () => {
    const events = normaliseEvents('calendar.family', [
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

describe('rewriteTitle, with the F1 recipe', () => {
  const shorten = (summary: string, location?: string | null) =>
    rewriteTitle(summary, f1.title!, location);
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
    expect(shorten(title(emoji, gp, session), location)).toBe(
      `${emoji} F1 ${location} - ${session}`,
    );
  });

  it('keeps the emoji exactly, including a variation selector', () => {
    expect(shorten(title('⏱️', 'X GRAND PRIX', 'Race'), 'Place')).toMatch(
      /^⏱️ F1 /u,
    );
  });

  it('uses the last " - " for the session', () => {
    expect(shorten('🏁 FORMULA 1 A - B GRAND PRIX 2026 - Race', 'Place')).toBe(
      '🏁 F1 Place - Race',
    );
  });

  it('leaves the title alone without a location', () => {
    const original = title('🏁', 'SINGAPORE GRAND PRIX', 'Race');
    expect(shorten(original, undefined)).toBe(original);
    expect(shorten(original, null)).toBe(original);
    expect(shorten(original, '  ')).toBe(original);
  });

  it('leaves a title that is not an F1 session alone', () => {
    expect(shorten('Dinner - with friends', 'Place')).toBe(
      'Dinner - with friends',
    );
    expect(shorten('🏁 FORMULA 1 SINGAPORE GRAND PRIX 2026', 'Place')).toBe(
      '🏁 FORMULA 1 SINGAPORE GRAND PRIX 2026',
    );
  });

  it('rewrites only the part the rule matches', () => {
    const rule = { match: /^Holiday: /u, replace: '' };
    expect(rewriteTitle('Holiday: Spain', rule)).toBe('Spain');
    expect(rewriteTitle('Trip: Spain', rule)).toBe('Trip: Spain');
  });

  it('puts $0 to $9 and a location with a $ in it in as plain text', () => {
    const rule = { match: /^(a)(b)$/u, replace: '$2$1 $0 $9 {location}' };
    expect(rewriteTitle('ab', rule, 'US$1 Bay')).toBe('ba ab  US$1 Bay');
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
    const event = normaliseEvent('calendar.f1', raw, f1);

    expect(event?.fullSummary).toBe(raw.summary);
    expect(event?.location).toBe('Singapore');
  });

  it('drops the F1 promotional description but not other calendars', () => {
    const withNotes = { ...raw, description: 'Follow all the action on F1 TV' };

    expect(normaliseEvent('calendar.f1', withNotes, f1)).not.toHaveProperty(
      'description',
    );
    expect(normaliseEvent('calendar.family', withNotes)?.description).toBe(
      'Follow all the action on F1 TV',
    );
  });

  it('shortens titles of a calendar with the rule only', () => {
    expect(normaliseEvent('calendar.f1', raw, f1)?.summary).toBe(
      '🏁 F1 Singapore - Race',
    );
    expect(normaliseEvent('calendar.family', raw)?.summary).toBe(raw.summary);
  });
});

describe('compileFormat', () => {
  it('compiles the title rule and leaves out unset options', () => {
    expect(compileFormat({})).toEqual({});
    expect(compileFormat({ hideNotes: false })).toEqual({});
    expect(compileFormat({ title: { match: 'a', replace: 'b' } })).toEqual({
      title: { match: /a/u, replace: 'b' },
    });
  });

  it('applies a birthday and a title rule together', () => {
    const event = normaliseEvent(
      'calendar.birthdays',
      {
        summary: "Sam's Birthday",
        description: 'Born 2004',
        start: { date: '2026-10-14' },
        end: { date: '2026-10-15' },
      },
      compileFormat({
        showYears: true,
        title: { match: ' Birthday$', replace: '' },
      }),
    );
    expect(event?.fullSummary).toBe("Sam's 22nd Birthday");
    expect(event?.summary).toBe("Sam's 22nd");
  });

  it('leaves the title alone unless the calendar asks for years', () => {
    const event = normaliseEvent('calendar.family', {
      summary: "Sam's Birthday",
      description: 'Born 2004',
      start: { date: '2026-10-14' },
      end: { date: '2026-10-15' },
    });
    expect(event?.summary).toBe("Sam's Birthday");
  });
});

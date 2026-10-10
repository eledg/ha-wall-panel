import type { RawCalendarEvent } from '../../ha/calendar.ts';

/** Raw events per calendar key (`calendarFamily`, ...), in HA's REST shape. */
export type CalendarScenario = {
  id: string;
  label: string;
  events: (now: Date) => Record<string, RawCalendarEvent[]>;
};

const at = (now: Date, dayOffset: number, hour: number, minute = 0) => {
  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
};

const timed = (
  summary: string,
  start: Date,
  minutes: number,
  location?: string,
): RawCalendarEvent => ({
  summary,
  ...(location ? { location } : {}),
  start: { dateTime: start.toISOString() },
  end: { dateTime: new Date(start.getTime() + minutes * 60_000).toISOString() },
});

/** HA's all-day events: plain dates, with the end day exclusive. */
const allDay = (summary: string, now: Date, dayOffset: number, days = 1) => {
  const date = (offset: number) => {
    const d = at(now, offset, 12);
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-');
  };
  return {
    summary,
    start: { date: date(dayOffset) },
    end: { date: date(dayOffset + days) },
  } satisfies RawCalendarEvent;
};

const F1 = 'FORMULA 1 SINGAPORE AIRLINES SINGAPORE GRAND PRIX 2026';

/** Like HA, each list is in no particular order. */
export const calendarScenarios: CalendarScenario[] = [
  {
    id: 'normal',
    label: 'Normal',
    events: (now) => {
      const later = Math.min(now.getHours() + 2, 22);
      return {
        calendarFamily: [
          timed('Football practice', at(now, 2, 10), 90),
          timed('Pick up groceries', at(now, 0, later, 30), 30),
        ],
        calendarBirthdays: [allDay("Alex's Birthday", now, 1)],
        calendarF1: [
          timed(`🏁 ${F1} - Race`, at(now, 1, 13), 120, 'Singapore'),
        ],
      };
    },
  },
  {
    id: 'empty',
    label: 'Empty day',
    events: (now) => ({
      calendarFamily: [],
      calendarBirthdays: [allDay("Jo's Birthday", now, 3)],
      calendarF1: [
        timed(`⏱️ ${F1} - Qualifying`, at(now, 2, 17), 60, 'Singapore'),
      ],
    }),
  },
  {
    id: 'busy',
    label: 'Busy day',
    events: (now) => {
      const later = Math.min(now.getHours() + 2, 22);
      return {
        calendarFamily: [
          timed("Parents' evening", at(now, 2, 18), 90),
          timed('Bins out (recycling)', at(now, 0, 23), 15),
          timed(
            'Dentist appointment (bring the referral letter and insurance details)',
            at(now, 0, later),
            45,
          ),
          timed('Swimming lessons', at(now, 0, Math.min(later + 1, 23)), 60),
        ],
        calendarBirthdays: [allDay("Sam's 9th Birthday", now, 0)],
        calendarF1: [
          timed(
            `🏎 ${F1} - Practice 3`,
            at(now, 0, Math.min(later + 1, 23), 30),
            60,
            'Singapore',
          ),
          timed(`🏁 ${F1} - Race`, at(now, 1, 13), 120, 'Singapore'),
        ],
      };
    },
  },
  {
    id: 'f1',
    label: 'F1 weekend',
    // The longest titles in a real season: a long place name, a long session.
    events: (now) => ({
      calendarFamily: [],
      calendarBirthdays: [],
      calendarF1: [
        timed(
          '🏎 FORMULA 1 ETIHAD AIRWAYS ABU DHABI GRAND PRIX 2026 - Practice 1',
          at(now, 0, Math.min(now.getHours() + 1, 22)),
          60,
          'United Arab Emirates',
        ),
        timed(
          '⏱️ FORMULA 1 SINGAPORE AIRLINES SINGAPORE GRAND PRIX 2026 - Sprint Qualification',
          at(now, 1, 12),
          60,
          'Singapore',
        ),
        timed(
          '🏁 FORMULA 1 SINGAPORE AIRLINES SINGAPORE GRAND PRIX 2026 - Sprint Race',
          at(now, 1, 16),
          60,
          'Singapore',
        ),
        timed(
          '🏎 FORMULA 1 MSC CRUISES UNITED STATES GRAND PRIX 2026 - Practice 2',
          at(now, 2, 22),
          60,
          'United States',
        ),
        timed(
          '🏁 FORMULA 1 GRAN PREMIO DE LA CIUDAD DE MÉXICO 2026 - Race',
          at(now, 3, 20),
          120,
          'Mexico',
        ),
      ],
    }),
  },
  {
    id: 'allday',
    label: 'All-day only',
    events: (now) => ({
      calendarFamily: [
        allDay('School inset day', now, 0),
        allDay('Friends staying (3 days)', now, -1, 3),
      ],
      calendarBirthdays: [
        allDay("Alex's Birthday", now, 1),
        allDay("Sam's 9th Birthday", now, 0),
      ],
      calendarF1: [],
    }),
  },
];

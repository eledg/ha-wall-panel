// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IDLE_CLOSE_MS } from '@/config/constants.ts';
import type { CalendarEvent } from '@/services/ha/calendar.ts';

import { durationLabel, EventSheet, untilLabel } from './event-sheet.tsx';

const NOW = new Date(2026, 9, 10, 12, 0); // Sat 10 Oct 2026, 12:00 local
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 9, day, hour, minute);

const event = (patch: Partial<CalendarEvent> = {}): CalendarEvent => ({
  calendar: 'calendarFamily',
  summary: 'Dentist',
  fullSummary: 'Dentist',
  start: at(10, 15).toISOString(),
  end: at(10, 15, 45).toISOString(),
  allDay: false,
  ...patch,
});

const text = () => document.body.textContent ?? '';
afterEach(() => {
  vi.useRealTimers();
  render(null, document.body);
});

describe('untilLabel', () => {
  it.each([
    [new Date(NOW.getTime() + 20_000), 'In 1 minute'],
    [at(10, 12, 25), 'In 25 minutes'],
    [at(10, 12, 59), 'In 59 minutes'],
    [new Date(NOW.getTime() + 59.5 * 60_000), 'In 1 hour'],
    [at(10, 13), 'In 1 hour'],
    [at(10, 13, 1), 'In 2 hours'],
    [at(10, 15), 'In 3 hours'],
    [at(11, 9), 'Tomorrow'],
    [at(13, 9), 'Tuesday'],
  ])('words %s as %s', (start, label) => {
    const end = new Date(start.getTime() + 3_600_000);
    expect(untilLabel(start, end, NOW)).toBe(label);
  });

  it('says Happening now while under way, and Finished after', () => {
    expect(untilLabel(at(10, 11), at(10, 13), NOW)).toBe('Happening now');
    expect(untilLabel(at(10, 9), at(10, 10), NOW)).toBe('Finished');
  });
});

describe('durationLabel', () => {
  it.each([
    [{ end: at(10, 15, 1).toISOString() }, '1 minute'],
    [{ end: at(10, 15, 45).toISOString() }, '45 minutes'],
    [{ end: at(10, 16).toISOString() }, '1 hour'],
    [{ end: at(10, 16, 1).toISOString() }, '1 hour 1 minute'],
    [{ end: at(10, 17).toISOString() }, '2 hours'],
    [{ end: at(10, 16, 30).toISOString() }, '1 hour 30 minutes'],
    [{ end: at(10, 17, 30).toISOString() }, '2 hours 30 minutes'],
    [
      {
        allDay: true,
        start: at(10, 0).toISOString(),
        end: at(11, 0).toISOString(),
      },
      'All day',
    ],
    [
      {
        allDay: true,
        start: at(10, 0).toISOString(),
        end: at(13, 0).toISOString(),
      },
      '3 days',
    ],
  ])('labels %j as %s', (patch, label) => {
    expect(durationLabel(event(patch))).toBe(label);
  });
});

describe('EventSheet', () => {
  const show = async (e: CalendarEvent, onClose = vi.fn(), idleMs?: number) => {
    await act(() => {
      render(
        <EventSheet
          event={e}
          onClose={onClose}
          now={() => NOW}
          {...(idleMs !== undefined && { idleMs })}
        />,
        document.body,
      );
    });
    return onClose;
  };

  it('shows the title, calendar, when, how long, location and notes', async () => {
    await show(
      event({
        location: 'High Street Dental',
        description: 'Check in early',
      }),
    );

    const dialog = document.querySelector('[role=dialog]')!;
    expect(dialog.getAttribute('aria-label')).toBe('Dentist');
    expect(text()).toContain('Dentist');
    expect(text()).toContain('Family');
    expect(text()).toContain('In 3 hours');
    expect(text()).toContain('Today');
    expect(text()).toContain('15:00 – 15:45');
    expect(text()).toContain('45 minutes');
    expect(text()).toContain('High Street Dental');
    expect(text()).toContain('Check in early');
  });

  it('shows the full title, not the tile one, and does not clip it', async () => {
    const full =
      '🏁 FORMULA 1 SINGAPORE AIRLINES SINGAPORE GRAND PRIX 2026 - Race';
    await show(
      event({
        calendar: 'calendarF1',
        summary: '🏁 F1 Singapore - Race',
        fullSummary: full,
      }),
    );

    const heading = document.querySelector('h2')!;
    expect(heading.textContent).toBe(full);
    expect(heading.className).not.toContain('truncate');
    expect(text()).not.toContain('F1 Singapore - Race');
  });

  it('leaves out Location and Notes when there are none', async () => {
    await show(event());

    expect(text()).not.toContain('Location');
    expect(text()).not.toContain('Notes');
  });

  it('shows an all-day event without times, and a multi-day span', async () => {
    await show(
      event({
        allDay: true,
        start: at(9, 0).toISOString(),
        end: at(12, 0).toISOString(),
      }),
    );

    expect(text()).toContain('All day');
    expect(text()).toContain('3 days');
    expect(text()).not.toContain('–');
  });

  it('keeps line breaks in the notes', async () => {
    await show(event({ description: 'First line\nSecond line' }));

    const notes = [...document.querySelectorAll('div')].find(
      (d) => d.textContent === 'First line\nSecond line',
    )!;
    expect(notes.className).toContain('whitespace-pre-line');
  });

  it('holds back auto-reload while open', async () => {
    await show(event());

    expect(document.querySelector('[data-blocks-reload]')).not.toBeNull();
  });

  it('closes from the close button', async () => {
    const onClose = await show(event());

    await act(() => {
      document
        .querySelector<HTMLButtonElement>('button[aria-label=Close]')!
        .click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', async () => {
    const onClose = await show(event());

    await act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes after the idle time, and a touch restarts it', async () => {
    vi.useFakeTimers();
    const onClose = await show(event());

    await act(() => {
      vi.advanceTimersByTime(IDLE_CLOSE_MS - 1000);
    });
    await act(() => {
      document
        .querySelector('[role=dialog]')!
        .dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    await act(() => {
      vi.advanceTimersByTime(IDLE_CLOSE_MS - 1000);
    });
    expect(onClose).not.toHaveBeenCalled();

    await act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

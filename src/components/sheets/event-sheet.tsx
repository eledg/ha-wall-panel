import { useEffect, useState } from 'preact/hooks';

import { XIcon } from '@/components/icons/x-icon.tsx';
import { IDLE_CLOSE_MS } from '@/config/constants.ts';
import { useMinute } from '@/hooks/use-minute.ts';
import { CALENDARS, dayLabel } from '@/lib/calendar-labels.ts';
import { formatTime } from '@/lib/format.ts';
import type { CalendarEvent } from '@/services/ha/calendar.ts';

const date = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const plural = (count: number, unit: string) =>
  `${count} ${unit}${count === 1 ? '' : 's'}`;

/** How far off an event is: `In 25 minutes`, `In 1 hour`, `Tomorrow`, then the weekday (`Friday`). */
export const untilLabel = (start: Date, end: Date, now: Date) => {
  const diff = start.getTime() - now.getTime();
  if (diff <= 0) return now < end ? 'Happening now' : 'Finished';
  const day = dayLabel(start, now);
  if (day === 'Tmrw') return 'Tomorrow';
  // Up to 59 minutes, so that 59 min 30 s reads "In 1 hour", not "In 60 minutes".
  if (diff <= 59 * MINUTE) {
    return `In ${plural(Math.ceil(diff / MINUTE), 'minute')}`;
  }
  if (day === 'Today') return `In ${plural(Math.ceil(diff / HOUR), 'hour')}`;
  return day;
};

/** `45 minutes`, `2 hours`, `1 hour 30 minutes`; an all-day event counts whole days. */
export const durationLabel = (event: CalendarEvent) => {
  const ms = Math.max(0, Date.parse(event.end) - Date.parse(event.start));
  if (event.allDay) {
    const days = Math.max(1, Math.round(ms / DAY));
    return days === 1 ? 'All day' : `${days} days`;
  }
  const mins = Math.round(ms / MINUTE);
  if (mins < 60) return plural(mins, 'minute');
  const hours = plural(Math.floor(mins / 60), 'hour');
  return mins % 60 ? `${hours} ${plural(mins % 60, 'minute')}` : hours;
};

const Field = ({ label, text }: { label: string; text: string }) => (
  <div>
    <div class="text-xs tracking-wider text-fg-dim uppercase">{label}</div>
    <div class="mt-0.5 text-lg leading-snug whitespace-pre-line">{text}</div>
  </div>
);

/**
 * Full-screen details for one calendar event, as in the design: the full title
 * (not the tile's shortened one), when, where and any notes. Closes with the
 * button, Escape, or after `idleMs` without a touch, so it never hides the
 * tiles. While open it holds back auto-reload, as every overlay must.
 */
export const EventSheet = ({
  event,
  onClose,
  now,
  idleMs = IDLE_CLOSE_MS,
}: {
  event: CalendarEvent;
  onClose: () => void;
  now?: () => Date;
  idleMs?: number;
}) => {
  const current = useMinute(now);
  // Bumped by every touch inside the sheet to restart the idle timer.
  const [activity, setActivity] = useState(0);

  useEffect(() => {
    const timer = setTimeout(onClose, idleMs);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, activity, idleMs]);

  const start = new Date(event.start);
  const end = new Date(event.end);
  const calendar = CALENDARS[event.calendar];
  const duration = durationLabel(event);
  const when =
    dayLabel(start, current) === 'Today' ? 'Today' : date.format(start);

  return (
    <dialog
      open
      aria-modal="true"
      aria-label={event.fullSummary}
      data-blocks-reload
      class="fixed inset-0 m-0 size-full max-h-none max-w-none border-0 text-fg z-20 bg-bg/90 p-6"
      onPointerDown={() => setActivity((n) => n + 1)}
    >
      <div class="flex h-full flex-col rounded-tile border border-line bg-surface p-5">
        <div class="mb-4 flex items-center justify-between gap-4">
          <h2 class="min-w-0 text-2xl leading-snug font-semibold">
            {event.fullSummary}
          </h2>
          <button
            type="button"
            aria-label="Close"
            class="tap grid size-14 shrink-0 place-items-center rounded-full bg-surface-2"
            onClick={onClose}
          >
            <XIcon class="size-7" />
          </button>
        </div>
        <div class="flex flex-1 flex-col gap-4 overflow-y-auto">
          <div class="flex items-center gap-2 text-lg">
            <span class={`size-3 rounded-full ${calendar?.bar ?? ''}`} />
            <span class={`font-medium ${calendar?.text ?? ''}`}>
              {calendar?.label}
            </span>
            <span class="text-fg-faint">·</span>
            <span class="text-fg-dim">{untilLabel(start, end, current)}</span>
          </div>
          <div class="rounded-xl bg-surface-2 p-4">
            <div class="text-3xl font-semibold">{when}</div>
            <div class="tnum mt-1 text-xl text-fg-dim">
              {event.allDay
                ? 'All day'
                : `${formatTime(start)} – ${formatTime(end)}`}
              {duration !== 'All day' && (
                <span class="ml-2 text-base">· {duration}</span>
              )}
            </div>
          </div>
          {event.location && <Field label="Location" text={event.location} />}
          {event.description && (
            <Field label="Notes" text={event.description} />
          )}
        </div>
      </div>
    </dialog>
  );
};

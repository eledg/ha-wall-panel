import { hourOf, zonedInstant, zonedParts } from '@/config/datetime.ts';

/** `auto` follows the schedule; `on` and `off` are for the mock dev panel. */
export type NightMode = 'auto' | 'on' | 'off';

const HOUR_MS = 3_600_000;

/** Whether `now` falls in the night, which may span midnight. */
export const isNight = (
  now: Date,
  startHour: number,
  endHour: number,
): boolean => {
  const h = hourOf(now);
  return startHour <= endHour
    ? h >= startHour && h < endHour
    : h >= startHour || h < endHour;
};

/** Milliseconds until the next time the schedule changes (at least 1). */
export const msToNextBoundary = (
  now: Date,
  startHour: number,
  endHour: number,
): number => {
  const next = (hour: number) => {
    const { year, month, day } = zonedParts(now);
    let at = zonedInstant({ year, month, day, hour });
    if (at.getTime() <= now.getTime())
      at = zonedInstant({ year, month, day: day + 1, hour });
    return at.getTime() - now.getTime();
  };
  return Math.max(1, Math.min(next(startHour), next(endHour), 24 * HOUR_MS));
};

let mode: NightMode = 'auto';
const listeners = new Set<() => void>();

export const getNightMode = () => mode;

/** Forces night on or off, or back to the schedule. Used by the mock panel. */
export const setNightMode = (next: NightMode) => {
  mode = next;
  listeners.forEach((listener) => listener());
};

export const subscribeNightMode = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

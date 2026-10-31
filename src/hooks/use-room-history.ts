import { useEffect, useState } from 'preact/hooks';

import {
  type Interval,
  type Sample,
  toIntervals,
  toSeries,
} from '@/services/ha/history.ts';
import type { HaStore } from '@/services/ha/store.ts';

/** The history is re-read this often while the room sheet is open. */
export const HISTORY_REFRESH_MS = 60_000;

/** What the room sheet charts: the window and each series (`undefined` until read, or when not linked). */
export type RoomHistory = {
  start: number;
  end: number;
  temps: Sample[] | undefined;
  humidity: Sample[] | undefined;
  heating: Interval[] | undefined;
  /** Heating power in percent, when the heating tile has a power sensor. */
  power: Sample[] | undefined;
  ac: Interval[] | undefined;
};

const notOff = (state: string) => state !== 'off';

/** A failed refresh keeps what is shown. */
const keep = <T>(next: T | undefined, before: T | undefined) => next ?? before;

/**
 * Reads the room's history over the last `hours` when mounted, then every
 * minute: the two sensors, and, when given, the heating demand sensor and the
 * AC climate entity. Each is read on its own, so one failing leaves the others.
 * A failed refresh keeps the earlier data; a failed first read of a sensor is
 * empty, of a linked tile is left out.
 */
export const useRoomHistory = (
  store: HaStore,
  hours: number,
  ids: {
    temperature: string;
    humidity: string;
    demand?: string;
    power?: string;
    ac?: string;
  },
) => {
  const [history, setHistory] = useState<RoomHistory>();
  const { temperature, humidity, demand, power, ac } = ids;

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      const end = Date.now();
      const start = end - hours * 3_600_000;
      const read = <T>(
        id: string | undefined,
        parse: (rows: Awaited<ReturnType<HaStore['history']>>) => T,
      ) =>
        id === undefined
          ? Promise.resolve(undefined)
          : store
              .history(id, new Date(start), new Date(end))
              .then(parse, (err: unknown) => {
                console.error(`Climate history of ${id} failed`, err);
                return undefined;
              });
      void Promise.all([
        read(temperature, (rows) => toSeries(rows, start, end)),
        read(humidity, (rows) => toSeries(rows, start, end)),
        read(demand, (rows) => toIntervals(rows, start, end)),
        read(power, (rows) => toSeries(rows, start, end)),
        read(ac, (rows) => toIntervals(rows, start, end, notOff)),
      ]).then(([temps, humidities, heatingRuns, powers, acRuns]) => {
        if (cancelled) return;
        setHistory((previous) => ({
          start,
          end,
          temps: keep(temps, previous?.temps) ?? [],
          humidity: keep(humidities, previous?.humidity) ?? [],
          heating: keep(heatingRuns, previous?.heating),
          power: keep(powers, previous?.power),
          ac: keep(acRuns, previous?.ac),
        }));
      });
    };
    load();
    const timer = setInterval(load, HISTORY_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [store, hours, temperature, humidity, demand, power, ac]);

  return history;
};

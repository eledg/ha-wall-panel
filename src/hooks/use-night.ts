import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

import { getConfig, type NightConfig } from '@/config/config.ts';
import { useSnapshot } from '@/hooks/use-snapshot.ts';
import {
  getNightMode,
  isNight,
  msToNextBoundary,
  subscribeNightMode,
} from '@/lib/night.ts';
import { haStore } from '@/services/ha/instance.ts';
import type { HaStore } from '@/services/ha/store.ts';

const systemNow = () => new Date();

/**
 * Night state for the shell. While it is night the display is dimmed until a
 * tap wakes it for `wakeMs`. The clock is injectable, as for `usePixelShift`.
 * While the `overrideSwitch` is on, the clock is ignored and it is day; a switch
 * that is off, unknown, unavailable or missing leaves the clock in charge.
 */
export const useNight = (
  now: () => Date = systemNow,
  { startHour, endHour, wakeMs, overrideSwitch }: NightConfig = getConfig()
    .night,
  store: HaStore = haStore,
) => {
  const overridden =
    useSnapshot(store, (s) =>
      overrideSwitch === undefined
        ? undefined
        : s.entities[overrideSwitch]?.state,
    ) === 'on';
  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick((n) => n + 1), []);
  const [awake, setAwake] = useState(false);
  const wakeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => subscribeNightMode(rerender), [rerender]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(
        () => {
          rerender();
          schedule();
        },
        msToNextBoundary(now(), startHour, endHour),
      );
    };
    schedule();
    return () => clearTimeout(timer);
  }, [now, startHour, endHour, rerender]);

  useEffect(() => () => clearTimeout(wakeTimerRef.current), []);

  const wake = useCallback(() => {
    setAwake(true);
    clearTimeout(wakeTimerRef.current);
    wakeTimerRef.current = setTimeout(() => setAwake(false), wakeMs);
  }, [wakeMs]);

  const night =
    getNightMode() === 'on' ||
    (getNightMode() === 'auto' &&
      !overridden &&
      isNight(now(), startHour, endHour));
  return { night, dimmed: night && !awake, wake };
};

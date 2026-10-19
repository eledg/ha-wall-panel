import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

import { getConfig, type NightConfig } from '@/config/config.ts';
import {
  getNightMode,
  isNight,
  msToNextBoundary,
  subscribeNightMode,
} from '@/lib/night.ts';

const systemNow = () => new Date();

/**
 * Night state for the shell. While it is night the display is dimmed until a
 * tap wakes it for `wakeMs`. The clock is injectable, as for `usePixelShift`.
 */
export const useNight = (
  now: () => Date = systemNow,
  { startHour, endHour, wakeMs }: NightConfig = getConfig().night,
) => {
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
    (getNightMode() === 'auto' && isNight(now(), startHour, endHour));
  return { night, dimmed: night && !awake, wake };
};

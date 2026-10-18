import { useEffect, useState } from 'preact/hooks';

/** Milliseconds until the next whole minute (a full minute on the boundary). */
export const msToNextMinute = (now: Date) =>
  60_000 - (now.getSeconds() * 1000 + now.getMilliseconds());

const systemNow = () => new Date();

/**
 * Re-renders on every whole minute. Each wait is recomputed from the clock
 * rather than using a fixed interval, so timer lateness never accumulates.
 */
export const useMinute = (now: () => Date = systemNow) => {
  const [current, setCurrent] = useState(now);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setCurrent(now());
        schedule();
      }, msToNextMinute(now()));
    };
    // Catch a minute that passed between first render and this effect.
    setCurrent(now());
    schedule();
    return () => clearTimeout(timer);
  }, [now]);
  return current;
};

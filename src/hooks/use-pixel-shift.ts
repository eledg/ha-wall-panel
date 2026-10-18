import type { RefObject } from 'preact';
import { useEffect } from 'preact/hooks';

import { msToNextStep, shiftAt, shiftTransform } from '@/lib/pixel-shift.ts';

const systemNow = () => new Date();

/**
 * Slowly moves the element a few pixels so static content doesn't sit on the
 * same pixels all day. Writes the style directly rather than through state:
 * no re-render, and a transform never triggers layout.
 */
export const usePixelShift = (
  ref: RefObject<HTMLElement | null>,
  now: () => Date = systemNow,
) => {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const apply = () => {
      const el = ref.current;
      if (el) el.style.transform = shiftTransform(shiftAt(now()));
      timer = setTimeout(apply, msToNextStep(now()));
    };
    apply();
    return () => clearTimeout(timer);
  }, [ref, now]);
};

import type { RefObject } from 'preact';
import { useEffect } from 'preact/hooks';

/** How long the grid rests at each offset. */
export const SHIFT_STEP_MS = 5 * 60_000;

/**
 * Offsets in px, walked in order and then repeated: a loop around the origin,
 * never more than 4 px out. Well inside the edge zone (`--spacing-edge`).
 */
export const SHIFT_PATH: readonly (readonly [number, number])[] = [
  [0, 0],
  [2, -3],
  [4, -1],
  [3, 2],
  [1, 4],
  [-2, 3],
  [-4, 1],
  [-3, -2],
  [-1, -4],
  [2, -2],
  [-2, 2],
  [0, 0],
];

/**
 * The offset for a moment in time. Derived from the wall clock, so it needs no
 * stored state and carries on correctly after a reload.
 */
export const shiftAt = (now: Date, stepMs = SHIFT_STEP_MS) => {
  const step = Math.floor(now.getTime() / stepMs);
  return SHIFT_PATH[step % SHIFT_PATH.length]!;
};

/** Milliseconds until the next step (a full step on the boundary). */
export const msToNextStep = (now: Date, stepMs = SHIFT_STEP_MS) =>
  stepMs - (now.getTime() % stepMs);

export const shiftTransform = ([x, y]: readonly [number, number]) =>
  `translate(${x}px, ${y}px)`;

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

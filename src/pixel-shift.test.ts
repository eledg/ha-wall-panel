import { describe, expect, it } from 'vitest';

import {
  msToNextStep,
  SHIFT_PATH,
  SHIFT_STEP_MS,
  shiftAt,
  shiftTransform,
} from './pixel-shift.ts';

describe('shiftAt', () => {
  it('is the same within a step and changes at the boundary', () => {
    const start = new Date(SHIFT_STEP_MS * 7);
    const justBefore = new Date(SHIFT_STEP_MS * 8 - 1);
    expect(shiftAt(justBefore)).toEqual(shiftAt(start));
    expect(shiftAt(new Date(SHIFT_STEP_MS * 8))).not.toEqual(shiftAt(start));
  });

  it('visits the whole path, then repeats', () => {
    const seen = SHIFT_PATH.map((_, i) => shiftAt(new Date(i * SHIFT_STEP_MS)));
    expect(seen).toEqual(SHIFT_PATH);
    expect(shiftAt(new Date(SHIFT_PATH.length * SHIFT_STEP_MS))).toEqual(
      SHIFT_PATH[0],
    );
  });

  it('never strays more than 4 px', () => {
    for (const [x, y] of SHIFT_PATH) {
      expect(Math.abs(x)).toBeLessThanOrEqual(4);
      expect(Math.abs(y)).toBeLessThanOrEqual(4);
    }
  });
});

describe('msToNextStep', () => {
  it('counts down to the next boundary', () => {
    expect(msToNextStep(new Date(SHIFT_STEP_MS * 3 + 1000))).toBe(
      SHIFT_STEP_MS - 1000,
    );
  });

  it('waits a full step on the boundary', () => {
    expect(msToNextStep(new Date(SHIFT_STEP_MS * 3))).toBe(SHIFT_STEP_MS);
  });
});

describe('shiftTransform', () => {
  it('formats a CSS translate', () => {
    expect(shiftTransform([2, -3])).toBe('translate(2px, -3px)');
  });
});

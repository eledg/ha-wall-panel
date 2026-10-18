import { describe, expect, it } from 'vitest';

import { formatTarget, stepTarget } from './target.ts';

describe('stepTarget', () => {
  const limits = { min: 16, max: 30, step: 0.5 };

  it('steps by the entity step without float drift', () => {
    expect(stepTarget(21, 1, limits)).toBe(21.5);
    expect(stepTarget(21, -1, limits)).toBe(20.5);
    expect(stepTarget(20.1, 1, { ...limits, step: 0.1 })).toBe(20.2);
  });

  it('stops at the limits', () => {
    expect(stepTarget(30, 1, limits)).toBe(30);
    expect(stepTarget(16, -1, limits)).toBe(16);
  });
});

describe('formatTarget', () => {
  it('formats temperatures to the step', () => {
    expect(formatTarget(24, 0.5)).toBe('24.0');
    expect(formatTarget(24.5, 0.5)).toBe('24.5');
    expect(formatTarget(24, 1)).toBe('24');
  });
});

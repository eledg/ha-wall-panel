import { describe, expect, it } from 'vitest';

import { rateMax, rateMin, worst } from './status.ts';

describe('rateMax', () => {
  it('is green at the limit, amber up to 1.5x, then red', () => {
    expect(rateMax(100, 100)).toBe('good');
    expect(rateMax(101, 100)).toBe('warn');
    expect(rateMax(150, 100)).toBe('warn');
    expect(rateMax(151, 100)).toBe('bad');
  });

  it('is unknown without a value', () => {
    expect(rateMax(undefined, 100)).toBe('unknown');
  });
});

describe('rateMin', () => {
  it('is green at the limit, amber down to 2/3, then red', () => {
    expect(rateMin(30, 30)).toBe('good');
    expect(rateMin(29, 30)).toBe('warn');
    expect(rateMin(20, 30)).toBe('warn');
    expect(rateMin(19, 30)).toBe('bad');
  });

  it('is unknown without a value', () => {
    expect(rateMin(undefined, 30)).toBe('unknown');
  });
});

describe('worst', () => {
  it('picks the most severe light and ignores unknown', () => {
    expect(worst('good', 'warn', 'unknown')).toBe('warn');
    expect(worst('good', 'bad', 'warn')).toBe('bad');
    expect(worst('unknown', 'good')).toBe('good');
  });

  it('is unknown when nothing is measured', () => {
    expect(worst('unknown', 'unknown')).toBe('unknown');
    expect(worst()).toBe('unknown');
  });
});

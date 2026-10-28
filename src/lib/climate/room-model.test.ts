import { describe, expect, it } from 'vitest';

import type { AcView } from './ac-model.ts';
import type { HeatingView } from './heating-model.ts';
import {
  acLine,
  bands,
  comfort,
  extent,
  heatingLine,
  linePath,
  targetY,
  tempScale,
} from './room-model.ts';

describe('comfort', () => {
  it.each([
    [21, 48, 'Comfortable', false],
    [21, 70, 'Humid', true],
    [21, 25, 'Dry air', true],
    [16, 48, 'Cool', true],
    [27, 48, 'Warm', true],
    [undefined, undefined, 'Comfortable', false],
  ])('%s° %s%% is %s', (t, h, label, warn) => {
    expect(comfort(t, h)).toEqual({ label, warn });
  });

  it('puts humidity before temperature', () => {
    expect(comfort(16, 70).label).toBe('Humid');
  });
});

describe('extent and tempScale', () => {
  it('finds the range, or nothing', () => {
    expect(
      extent([
        { at: 0, value: 20.2 },
        { at: 1, value: 22.4 },
      ]),
    ).toEqual({ min: 20.2, max: 22.4 });
    expect(extent([])).toBeUndefined();
    expect(extent(undefined)).toBeUndefined();
  });

  it('pads by half a degree and rounds out', () => {
    expect(tempScale(20.2, 22.4)).toEqual({ min: 19, max: 23 });
  });
});

describe('linePath', () => {
  it('maps time to x and value to y', () => {
    expect(
      linePath(
        [
          { at: 0, value: 10 },
          { at: 50, value: 20 },
          { at: 100, value: 15 },
        ],
        0,
        100,
        10,
        20,
      ),
    ).toBe('M0 200 L300 0 L600 100');
  });
});

describe('bands', () => {
  it('keeps only the on stretches', () => {
    expect(
      bands(
        [
          { start: 0, end: 25, on: false },
          { start: 25, end: 50, on: true },
          { start: 50, end: 100, on: false },
        ],
        0,
        100,
      ),
    ).toEqual([{ x: 150, width: 150 }]);
  });
});

describe('targetY', () => {
  it('is undefined outside the axis or without a target', () => {
    expect(targetY(15, 10, 20)).toBe(100);
    expect(targetY(25, 10, 20)).toBeUndefined();
    expect(targetY(undefined, 10, 20)).toBeUndefined();
  });
});

describe('button lines', () => {
  const heating = (over: Partial<HeatingView>) =>
    ({
      state: 'schedule',
      on: true,
      demand: true,
      target: 20,
      ...over,
    }) as HeatingView;
  const ac = (over: Partial<AcView>) =>
    ({ on: true, mode: 'cool', target: 22, ...over }) as AcView;

  it('describes the heating', () => {
    expect(heatingLine(heating({}))).toBe('Target 20.0° · heating');
    expect(heatingLine(heating({ demand: false }))).toBe('Target 20.0° · idle');
    expect(heatingLine(heating({ on: false, state: 'off' }))).toBe('Off');
    expect(heatingLine(heating({ on: false, state: 'paused' }))).toBe('Paused');
  });

  it('describes the AC', () => {
    expect(acLine(ac({}))).toBe('Cool · target 22.0°');
    expect(acLine(ac({ target: undefined }))).toBe('Cool');
    expect(acLine(ac({ on: false }))).toBe('Off');
  });
});

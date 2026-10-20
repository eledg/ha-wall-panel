import { describe, expect, it } from 'vitest';

import { GRID, placeStyle } from './grid.ts';

describe('placeStyle', () => {
  it('sets the custom properties the tile-place class reads', () => {
    expect(placeStyle({ col: 4, row: 1, w: 3, h: 2 })).toEqual({
      '--col': '4',
      '--row': '1',
      '--w': '3',
      '--h': '2',
      '--nw': '2',
    });
  });

  it('gives a one-column tile one column in portrait, and anything wider two', () => {
    expect(placeStyle({ col: 1, row: 1, w: 1, h: 1 })['--nw']).toBe('1');
    expect(placeStyle({ col: 1, row: 1, w: 2, h: 1 })['--nw']).toBe('2');
    expect(placeStyle({ col: 1, row: 1, w: 6, h: 1 })['--nw']).toBe('2');
  });
});

describe('GRID', () => {
  it('is six columns by three rows', () => {
    expect(GRID.cols).toBe('repeat(6, minmax(0, 1fr))');
    expect(GRID.rows).toBe('repeat(3, minmax(0, 1fr))');
  });
});

import { GRID_COLS, GRID_ROWS } from '@/config/config.ts';
import type { Placement } from '@/config/config.ts';

/**
 * Tile grid for the wall display (landscape 6 x 3). Each tile sits where its
 * config puts it (see `placeStyle`). Portrait is two columns, filled in the
 * order the tiles are listed.
 */
export const GRID = {
  cols: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
  rows: `repeat(${GRID_ROWS}, minmax(0, 1fr))`,
} as const;

/** Columns of the portrait grid. */
export const NARROW_COLS = 2;

/**
 * The custom properties the `tile-place` class (index.css) reads. In portrait a
 * tile wider than one column takes both, and every tile takes one row.
 */
export const placeStyle = ({ col, row, w, h }: Placement) => ({
  '--col': String(col),
  '--row': String(row),
  '--w': String(w),
  '--h': String(h),
  '--nw': String(Math.min(w, NARROW_COLS)),
});

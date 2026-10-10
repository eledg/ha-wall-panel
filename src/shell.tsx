import type { ComponentChildren } from 'preact';

import { GRID } from './grid.ts';

/**
 * Page frame: keeps everything out of the edge zone and lays tiles out on the
 * named-area grid in `grid.ts`. Tiles place themselves with their `area`.
 */
export const Shell = ({ children }: { children?: ComponentChildren }) => (
  <main class="box-border h-dvh p-edge">
    <div
      class="dash-grid h-full"
      style={{
        '--cols': GRID.cols,
        '--rows': GRID.rows,
        '--areas': GRID.areas,
        '--areas-narrow': GRID.areasNarrow,
      }}
    >
      {children}
    </div>
  </main>
);

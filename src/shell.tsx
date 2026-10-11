import type { ComponentChildren } from 'preact';
import { useRef } from 'preact/hooks';

import { GRID } from './grid.ts';
import { usePixelShift } from './pixel-shift.ts';

/**
 * Page frame: keeps everything out of the edge zone and lays tiles out on the
 * named-area grid in `grid.ts`. Tiles place themselves with their `area`. The
 * grid drifts a few pixels over time to spare the panel from burn-in.
 */
export const Shell = ({ children }: { children?: ComponentChildren }) => {
  const grid = useRef<HTMLDivElement>(null);
  usePixelShift(grid);
  return (
    <main class="box-border h-dvh p-edge">
      <div
        ref={grid}
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
};

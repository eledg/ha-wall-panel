import type { ComponentChildren } from 'preact';
import { useRef } from 'preact/hooks';

import { useNight } from '@/hooks/use-night.ts';
import { usePixelShift } from '@/hooks/use-pixel-shift.ts';
import { GRID } from '@/lib/grid.ts';

/**
 * Page frame: keeps everything out of the edge zone and lays tiles out on the
 * named-area grid in `grid.ts`. Tiles place themselves with their `area`. The
 * grid drifts a few pixels over time to spare the panel from burn-in. At night
 * the palette turns warm and the display dims until a tap wakes it.
 */
export const Shell = ({ children }: { children?: ComponentChildren }) => {
  const grid = useRef<HTMLDivElement>(null);
  usePixelShift(grid);
  const { night, dimmed, wake } = useNight();
  return (
    <main
      class="relative box-border h-dvh p-edge"
      data-night={night ? 'true' : undefined}
    >
      <div
        ref={grid}
        class={`dash-grid h-full ${dimmed ? 'opacity-60' : ''}`}
        style={{
          '--cols': GRID.cols,
          '--rows': GRID.rows,
          '--areas': GRID.areas,
          '--areas-narrow': GRID.areasNarrow,
        }}
      >
        {children}
      </div>
      {dimmed && (
        // The first tap only wakes the display, so a stray touch changes nothing.
        <button
          type="button"
          aria-label="Wake display"
          class="absolute inset-0 z-10"
          onClick={wake}
        />
      )}
    </main>
  );
};

import type { ComponentChildren } from 'preact';
import { useRef } from 'preact/hooks';

import { useNight } from '@/hooks/use-night.ts';
import { usePixelShift } from '@/hooks/use-pixel-shift.ts';
import { GRID } from '@/lib/grid.ts';

/**
 * Page frame: keeps everything out of the edge zone and lays tiles out on the
 * grid in `grid.ts`. Tiles place themselves from their config (`placeStyle`). The
 * grid drifts a few pixels over time to spare the panel from burn-in. At night
 * the palette turns warm and, until a tap wakes it, drops to a darker set of solid
 * colours (`[data-dimmed]`), not opacity: see docs/display.md.
 */
export const Shell = ({ children }: { children?: ComponentChildren }) => {
  const grid = useRef<HTMLDivElement>(null);
  usePixelShift(grid);
  const { night, dimmed, wake } = useNight();
  return (
    <main
      class="relative box-border h-dvh p-edge text-fg"
      data-night={night ? 'true' : undefined}
      data-dimmed={dimmed ? 'true' : undefined}
    >
      <div
        ref={grid}
        class="dash-grid h-full"
        style={{
          '--cols': GRID.cols,
          '--rows': GRID.rows,
        }}
      >
        {children}
      </div>
      {dimmed && (
        // The first tap only wakes the display, so a stray touch changes nothing.
        // Not a real button: the display paints a background-less one grey, which
        // lit the whole screen (docs/display.md, "Buttons get a default grey background").
        <div
          role="button"
          tabIndex={0}
          aria-label="Wake display"
          class="absolute inset-0 z-10"
          onClick={wake}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') wake();
          }}
        />
      )}
    </main>
  );
};

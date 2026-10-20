import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

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
  // On <html>, not <main>: the diagnostics, config warning and disconnected
  // banner render outside <main>, and inherited text (`body` sets `text-fg`)
  // only follows the palette if the tokens are defined at or above `body`.
  useEffect(() => {
    const { dataset } = document.documentElement;
    const state = { night, dimmed };
    for (const key of ['night', 'dimmed'] as const) {
      if (state[key]) dataset[key] = 'true';
      else delete dataset[key];
    }
    return () => {
      delete dataset.night;
      delete dataset.dimmed;
    };
  }, [night, dimmed]);
  return (
    <main class="relative box-border h-dvh p-edge">
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
          class="absolute inset-0 z-40"
          onClick={wake}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') wake();
          }}
        />
      )}
    </main>
  );
};

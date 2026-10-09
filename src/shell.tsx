import type { ComponentChildren } from 'preact';

/**
 * Page frame: keeps everything out of the edge zone and lays tiles out on a
 * grid that fills the width in landscape and drops to fewer columns in portrait.
 */
export const Shell = ({ children }: { children?: ComponentChildren }) => (
  <main class="min-h-dvh p-edge">
    <div class="grid grid-cols-[repeat(auto-fill,minmax(var(--spacing-tile),1fr))] auto-rows-(--spacing-tile-height) gap-gap">
      {children}
    </div>
  </main>
);

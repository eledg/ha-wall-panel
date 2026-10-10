import { useEffect, useRef, useState } from 'preact/hooks';

import type { MockControls } from './engine.ts';
import { panels } from './panels/index.ts';

/**
 * The one dev control for `pnpm dev:mock`: a tab hanging from the top right
 * corner, inside the page's edge gutter so it covers no tile. It opens a panel
 * beside the tiles rather than over them, so the effect of each control stays
 * visible. A press outside the panel, or Escape, closes it.
 */
export const Overlay = ({ mock }: { mock: MockControls }) => {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root}>
      <button
        type="button"
        aria-expanded={open}
        class="fixed top-0 right-edge z-20 h-edge rounded-b border border-t-0 border-line bg-surface px-3 font-mono text-small text-fg-dim"
        onClick={() => setOpen(!open)}
      >
        Mock
      </button>
      {open && (
        <aside
          aria-label="Mock HA"
          class="fixed top-edge right-edge bottom-edge z-20 w-80 overflow-auto rounded-tile border border-line bg-surface p-3"
        >
          {panels.map(({ id, title, Panel }) => (
            <section
              key={id}
              aria-labelledby={`mock-${id}`}
              class="mb-4 border-b border-line pb-1 last:mb-0 last:border-b-0"
            >
              <h2 id={`mock-${id}`} class="mb-2 text-label font-semibold">
                {title}
              </h2>
              <Panel mock={mock} />
            </section>
          ))}
        </aside>
      )}
    </div>
  );
};

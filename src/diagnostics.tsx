import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';

import { XIcon } from './icons/x-icon.tsx';

/** Close the modal after this long without a touch, so it never hides the tiles. */
export const IDLE_CLOSE_MS = 30_000;

/**
 * The build version, bottom right. Tapping it opens a modal with the build
 * details and whatever debug content is passed as children.
 */
export const Diagnostics = ({
  children,
  idleMs = IDLE_CLOSE_MS,
}: {
  children?: ComponentChildren;
  idleMs?: number;
}) => {
  const [open, setOpen] = useState(false);
  // Bumped by every touch inside the modal to restart the idle timer.
  const [activity, setActivity] = useState(0);
  const { version, commit, builtAt } = __BUILD_INFO__;

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setOpen(false), idleMs);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, activity, idleMs]);

  return (
    <>
      <button
        type="button"
        class="fixed right-edge bottom-edge flex min-h-12 min-w-12 items-center justify-end font-mono text-small text-text-muted"
        onClick={() => setOpen(true)}
      >
        {version}
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Diagnostics"
          class="fixed inset-edge z-10 rounded-tile border border-line bg-surface"
          onPointerDown={() => setActivity((n) => n + 1)}
        >
          {/* Scrolls inside the rounded frame: the display's browser draws square corners when the rounded element itself scrolls. */}
          <div class="size-full overflow-auto rounded-tile p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div class="flex items-start justify-between gap-gap">
              <dl class="font-mono text-small text-text-muted">
                <dt class="sr-only">Version</dt>
                <dd>Version {version}</dd>
                <dt class="sr-only">Commit</dt>
                <dd>Commit {commit.slice(0, 7)}</dd>
                <dt class="sr-only">Built</dt>
                <dd>Built {builtAt}</dd>
              </dl>
              <button
                type="button"
                aria-label="Close"
                class="flex size-12 shrink-0 items-center justify-center rounded border border-line"
                onClick={() => setOpen(false)}
              >
                <XIcon />
              </button>
            </div>
            {children}
          </div>
        </div>
      )}
    </>
  );
};

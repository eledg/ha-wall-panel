import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';

import { XIcon } from '@/components/icons/x-icon.tsx';
import { IDLE_CLOSE_MS } from '@/config/constants.ts';
import { useSnapshot } from '@/hooks/use-snapshot.ts';
import { type CheckNowResult, createManualUpdate } from '@/lib/auto-reload.ts';
import { haStore } from '@/services/ha/instance.ts';
import type { HaStatus } from '@/services/ha/store.ts';

const STATUS_LABEL: Record<HaStatus, string> = {
  idle: 'Not connected',
  connecting: 'Connecting',
  connected: 'Connected',
  disconnected: 'Reconnecting',
  error: 'Reconnecting',
};

const BUILT_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'Europe/London',
  timeZoneName: 'short',
});

const formatBuilt = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : BUILT_FORMAT.format(date);
};

const CHECKED_FORMAT = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/London',
});

export type ManualUpdate = {
  checkNow: () => Promise<CheckNowResult>;
};

/**
 * The build version, bottom right in the edge margin under the last grid tile.
 * Tapping it opens a modal with the build details and whatever debug content
 * is passed as children.
 */
export const Diagnostics = ({
  children,
  idleMs = IDLE_CLOSE_MS,
  update,
}: {
  children?: ComponentChildren;
  idleMs?: number;
  /** Replaces the real check and reload, for tests. */
  update?: ManualUpdate;
}) => {
  const [open, setOpen] = useState(false);
  // Bumped by every touch inside the modal to restart the idle timer.
  const [activity, setActivity] = useState(0);
  const [manual] = useState(() => update ?? createManualUpdate(__BUILD_INFO__));
  // undefined until the first tap; 'checking' while the fetch runs.
  const [checked, setChecked] = useState<CheckNowResult | 'checking'>();
  const { version, commit, builtAt } = __BUILD_INFO__;
  const { status } = useSnapshot(haStore);
  const connected = status === 'connected';

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

  const statusText =
    checked === undefined
      ? ''
      : checked === 'checking'
        ? 'Checking for updates…'
        : checked.status === 'reloading'
          ? 'Update found. Reloading…'
          : checked.status === 'failed'
            ? "Couldn't check"
            : `Up to date — ${version} (${commit.slice(0, 7)}) · checked ${CHECKED_FORMAT.format(checked.at)}`;

  const getLatest = async () => {
    setChecked('checking');
    setChecked(await manual.checkNow());
  };

  return (
    <>
      <button
        type="button"
        aria-label="Diagnostics"
        class="fixed right-edge bottom-0 flex h-12 min-w-12 items-end justify-end bg-bg pb-2 font-mono text-[10px] text-fg-faint"
        onClick={() => setOpen(true)}
      >
        {version}
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="diagnostics-title"
          data-blocks-reload
          class="fixed inset-0 z-10 flex flex-col bg-bg text-fg"
          onPointerDown={() => setActivity((n) => n + 1)}
        >
          <header class="flex shrink-0 items-center justify-between gap-4 border-b border-line px-edge py-3">
            <div class="min-w-0">
              <h2
                id="diagnostics-title"
                class="truncate text-2xl font-semibold"
              >
                Diagnostics
              </h2>
              <p class="mt-1 flex items-center gap-2 text-sm text-fg-dim">
                <span
                  aria-hidden="true"
                  class={`size-2 shrink-0 rounded-full ${connected ? 'bg-ok' : 'bg-warn'}`}
                />
                Home Assistant · {STATUS_LABEL[status]}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close diagnostics"
              class="tap flex size-14 shrink-0 items-center justify-center rounded-full bg-surface-2"
              onClick={() => setOpen(false)}
            >
              <XIcon />
            </button>
          </header>
          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-edge pb-6">
            <section class="border-b border-line py-5">
              <h3 class="mb-3 text-sm font-semibold text-fg-dim">BUILD</h3>
              <dl class="grid grid-cols-[1fr_1fr_2fr] gap-x-6 gap-y-4">
                <div>
                  <dt class="text-small text-fg-dim">Version</dt>
                  <dd class="mt-1 font-medium">{version}</dd>
                </div>
                <div>
                  <dt class="text-small text-fg-dim">Commit</dt>
                  <dd class="tnum mt-1 font-mono text-small">
                    {commit.slice(0, 7)}
                  </dd>
                </div>
                <div>
                  <dt class="text-small text-fg-dim">Built</dt>
                  <dd class="tnum mt-1 text-small">
                    <time dateTime={builtAt}>{formatBuilt(builtAt)}</time>
                  </dd>
                </div>
              </dl>
            </section>
            {children}
            <section class="pt-5" aria-labelledby="update-title">
              <h3
                id="update-title"
                class="mb-3 text-sm font-semibold text-fg-dim"
              >
                SOFTWARE UPDATE
              </h3>
              <p
                aria-live="polite"
                class={`text-sm ${statusText && 'mb-3'} ${checked !== 'checking' && checked?.status === 'current' ? 'text-ok' : 'text-fg-dim'}`}
              >
                {statusText}
              </p>
              <button
                type="button"
                disabled={checked === 'checking'}
                class="tap flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-accent-fg transition-opacity duration-150 disabled:opacity-60"
                onClick={() => void getLatest()}
              >
                Get latest version
              </button>
            </section>
          </div>
        </div>
      )}
    </>
  );
};

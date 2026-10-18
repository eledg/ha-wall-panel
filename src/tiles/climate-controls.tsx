import type { ButtonHTMLAttributes, ComponentChildren } from 'preact';

import { XIcon } from '../icons/x-icon.tsx';

/**
 * A control inside a climate sheet. The background is opaque, as the display
 * paints a transparent button grey (docs/display.md#rendering-quirks).
 */
export const ClimateButton = ({
  class: className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...props}
    type={type}
    class={`tap min-h-14 rounded-lg border border-line bg-surface-2 disabled:cursor-not-allowed disabled:opacity-30 disabled:active:scale-100 ${String(className)}`}
  />
);

/**
 * The full-screen sheet shared by the climate controls: a title with a live
 * status line under it, a Close button, and a scrolling body. Holds back
 * auto-reload while open.
 */
export const ClimateSheet = ({
  title,
  titleId,
  status,
  warning = false,
  onClose,
  onActivity,
  children,
}: {
  title: string;
  titleId: string;
  status: ComponentChildren;
  warning?: boolean;
  onClose: () => void;
  /** Called on every touch inside the sheet, e.g. to restart an idle timer. */
  onActivity?: () => void;
  children: ComponentChildren;
}) => (
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    data-blocks-reload
    class="fixed inset-0 z-20 bg-bg/90 p-6"
    onPointerDown={onActivity}
  >
    <div class="flex h-full flex-col rounded-tile border border-line bg-surface p-5">
      <header class="mb-3 flex shrink-0 items-center justify-between gap-3">
        <div class="min-w-0">
          <h2 id={titleId} class="text-2xl font-semibold">
            {title}
          </h2>
          <div
            aria-live="polite"
            class={`text-sm ${warning ? 'text-warn' : 'text-fg-dim'}`}
          >
            {status}
          </div>
        </div>
        <ClimateButton
          aria-label="Close"
          onClick={onClose}
          class="grid size-14 shrink-0 place-items-center rounded-full"
        >
          <XIcon class="size-7" />
        </ClimateButton>
      </header>
      <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        {children}
      </div>
    </div>
  </div>
);

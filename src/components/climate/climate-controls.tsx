import type { ButtonHTMLAttributes, ComponentChildren } from 'preact';

import { PowerIcon } from '@/components/icons/power-icon.tsx';
import { XIcon } from '@/components/icons/x-icon.tsx';

/** A control whose call failed: the warning colours. */
export const WARN = 'border-warn! bg-warn-soft! text-warn';

/** A command waiting for HA: keep the last value, dimmed, with a pulsing border. */
export const pulseClass = (pending: boolean) =>
  pending ? 'pending-pulse opacity-60' : '';

/**
 * A control inside a climate sheet. The background is opaque, as the display
 * paints a transparent button grey (docs/display.md#rendering-quirks).
 */
export const ClimateButton = ({
  class: className = '',
  type = 'button',
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'class'> & {
  class?: string;
}) => (
  <button
    {...props}
    type={type}
    class={`tap min-h-14 rounded-lg border border-line bg-surface-2 disabled:cursor-not-allowed disabled:opacity-30 disabled:active:scale-100 ${className}`}
  />
);

/** The sheet's big On / Off button: lit when on, dimmed while its call is pending. */
export const PowerButton = ({
  label,
  on,
  disabled,
  pending,
  flashing,
  onClick,
}: {
  label: string;
  on: boolean;
  disabled: boolean;
  pending: boolean;
  flashing: boolean;
  onClick: () => void;
}) => {
  let state = 'text-fg-dim';
  if (flashing) state = WARN;
  else if (on) state = 'border-accent! bg-accent! text-accent-fg';
  return (
    <ClimateButton
      aria-label={label}
      aria-pressed={on}
      aria-busy={pending}
      disabled={disabled}
      class={`flex flex-col items-center justify-center gap-2 text-xl font-semibold ${pulseClass(pending)} ${state}`}
      onClick={onClick}
    >
      <PowerIcon class="size-8" />
      {on ? 'On' : 'Off'}
    </ClimateButton>
  );
};

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
  <dialog
    open
    aria-modal="true"
    aria-labelledby={titleId}
    data-blocks-reload
    class="fixed inset-0 m-0 size-full max-h-none max-w-none border-0 text-fg z-20 bg-bg/90 p-3"
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
  </dialog>
);

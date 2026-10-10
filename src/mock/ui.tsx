import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';

import type { MockControls } from './engine.ts';

export const Chip = ({
  active = false,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: string;
}) => (
  <button
    type="button"
    aria-pressed={active}
    class={`min-h-10 rounded border px-3 text-sm ${
      active
        ? 'border-accent bg-accent-soft text-accent'
        : 'border-line bg-surface-2'
    }`}
    onClick={onClick}
  >
    {children}
  </button>
);

export const Group = ({
  label,
  children,
}: {
  label: string;
  children: ComponentChildren;
}) => (
  <fieldset class="mb-3">
    <legend class="mb-1 text-xs tracking-wide text-fg-dim uppercase">
      {label}
    </legend>
    <div class="flex flex-wrap gap-1.5">{children}</div>
  </fieldset>
);

/** Re-renders the caller after every change the mock makes. */
export const useMockChanges = (mock: MockControls) => {
  const [, setTick] = useState(0);
  useEffect(() => mock.subscribe(() => setTick((n) => n + 1)), [mock]);
};

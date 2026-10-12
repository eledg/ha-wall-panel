import type { ComponentChildren } from 'preact';
import { useRef } from 'preact/hooks';

import type { EntityKey, HaStore } from '../../ha/store.ts';
import { useSnapshot } from '../../ha/use-snapshot.ts';
import { FanIcon } from '../../icons/fan-icon.tsx';
import { SnowflakeIcon } from '../../icons/snowflake-icon.tsx';
import { ThermoIcon } from '../../icons/thermo-icon.tsx';
import { useOptimistic } from '../use-optimistic.ts';

/** How long a control flashes after a rolled-back call (the design's 900 ms). */
export const FLASH_MS = 900;

export type SwitchKey = Extract<
  EntityKey,
  'acPowerful' | 'acEconomy' | 'acQuietFan'
>;

export const SWITCHES: { key: SwitchKey; label: string }[] = [
  { key: 'acPowerful', label: 'Powerful' },
  { key: 'acEconomy', label: 'Economy' },
  { key: 'acQuietFan', label: 'Quiet' },
];

export const NORMAL = 'border-line bg-surface-2 text-fg-dim';
export const ACTIVE = 'border-accent bg-accent-soft text-accent';
export const WARN = 'border-warn bg-warn-soft text-warn';

const stateClass = (flashing: boolean, active: boolean) =>
  flashing ? WARN : active ? ACTIVE : NORMAL;

export const ModeIcon = ({ mode }: { mode: string | undefined }) => {
  switch (mode) {
    case 'cool':
      return <SnowflakeIcon />;
    case 'heat':
      return <ThermoIcon />;
    case 'fan_only':
      return <FanIcon />;
    case 'dry':
      return (
        <span aria-hidden="true" class="text-sm font-bold">
          D
        </span>
      );
    case 'auto':
      return (
        <span aria-hidden="true" class="text-sm font-bold">
          A
        </span>
      );
    default:
      return null;
  }
};

/** One on/off switch entity (Powerful, Economy, Quiet), with its own optimistic state. */
export const SwitchButton = ({
  store,
  entity,
  label,
  disabled,
  flashing,
  onFail,
}: {
  store: HaStore;
  entity: SwitchKey;
  label: string;
  disabled: boolean;
  flashing: boolean;
  onFail: (key: string) => void;
}) => {
  const state = useSnapshot(store, (s) => s.entities[entity]?.state);
  const usable = state === 'on' || state === 'off';
  const on = useOptimistic(state === 'on');
  const pendingRef = useRef(false);

  const toggle = () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    on.guess(!on.value);
    store
      .callService(entity, 'toggle')
      .catch((err: unknown) => {
        console.error(`Toggle AC ${label} failed`, err);
        on.clear();
        onFail(entity);
      })
      .finally(() => {
        pendingRef.current = false;
      });
  };

  return (
    <button
      type="button"
      disabled={disabled || !usable}
      aria-pressed={on.value}
      class={`tap flex h-14 items-center justify-center gap-2 rounded-xl border text-base font-medium ${stateClass(flashing, on.value)}`}
      onClick={toggle}
    >
      <span
        class={`size-2 rounded-full ${on.value ? 'bg-accent' : 'bg-fg-faint'}`}
      />
      {label}
      {!usable && <span class="text-xs text-warn">n/a</span>}
    </button>
  );
};

export const SummaryButton = ({
  label,
  value,
  icon,
  disabled,
  flashing,
  onClick,
}: {
  label: string;
  value: string;
  icon: ComponentChildren;
  disabled: boolean;
  flashing: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    disabled={disabled}
    class={`tap flex h-14 items-center gap-3 rounded-xl border px-3 text-left ${stateClass(flashing, false)}`}
    onClick={onClick}
  >
    <span class="grid size-5 shrink-0 place-items-center text-fg-dim">
      {icon}
    </span>
    <span class="min-w-0">
      <span class="block text-[11px] tracking-wider text-fg-faint uppercase">
        {label}
      </span>
      <span class="block truncate text-base font-medium text-fg">{value}</span>
    </span>
  </button>
);

import type { ComponentChildren } from 'preact';

import { FanIcon } from '@/components/icons/fan-icon.tsx';
import { PowerIcon } from '@/components/icons/power-icon.tsx';
import { SnowflakeIcon } from '@/components/icons/snowflake-icon.tsx';
import { ThermoIcon } from '@/components/icons/thermo-icon.tsx';
import type { EntityKey } from '@/services/ha/store.ts';

import { ClimateButton, pulseClass, WARN } from './climate-controls.tsx';

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
export const ACTIVE = 'border-accent! bg-accent-soft! text-accent';

export const stateClass = (flashing: boolean, active: boolean) => {
  if (flashing) return WARN;
  return active ? ACTIVE : NORMAL;
};

/** The mode's glyph: 20px in the picker and summary, 16px in the tile header. */
export const ModeIcon = ({
  mode,
  small = false,
}: {
  mode: string | undefined;
  small?: boolean;
}) => {
  const box = small ? 'size-4' : 'size-5';
  const letter = small ? 'text-xs' : 'text-sm';
  switch (mode) {
    case 'off':
      return <PowerIcon class={box} />;
    case 'cool':
      return <SnowflakeIcon class={box} />;
    case 'heat':
      return <ThermoIcon class={box} />;
    case 'fan_only':
      return <FanIcon class={box} />;
    case 'dry':
      return (
        <span aria-hidden="true" class={`${letter} font-bold`}>
          D
        </span>
      );
    case 'auto':
      return (
        <span aria-hidden="true" class={`${letter} font-bold`}>
          A
        </span>
      );
    default:
      return null;
  }
};

/** One on/off switch entity (Powerful, Economy, Quiet). */
export const SwitchButton = ({
  label,
  on,
  usable,
  disabled,
  pending,
  flashing,
  onToggle,
}: {
  label: string;
  on: boolean;
  usable: boolean;
  disabled: boolean;
  pending: boolean;
  flashing: boolean;
  onToggle: () => void;
}) => (
  <ClimateButton
    disabled={disabled || !usable}
    aria-pressed={on}
    aria-busy={pending}
    class={`flex items-center justify-center gap-2 text-base font-medium ${stateClass(flashing, on)} ${pulseClass(pending)}`}
    onClick={onToggle}
  >
    <span
      class={`size-2 shrink-0 rounded-full ${on ? 'bg-accent' : 'bg-fg-faint'}`}
    />
    {label}
    {!usable && <span class="text-xs text-warn">n/a</span>}
  </ClimateButton>
);

/** A setting (mode, fan speed, swing) with its current value; opens its picker. */
export const SummaryButton = ({
  label,
  value,
  icon,
  disabled,
  pending,
  flashing,
  onClick,
}: {
  label: string;
  value: string;
  icon: ComponentChildren;
  disabled: boolean;
  pending: boolean;
  flashing: boolean;
  onClick: () => void;
}) => (
  <ClimateButton
    disabled={disabled}
    aria-label={label}
    aria-busy={pending}
    class={`flex items-center gap-3 px-3 text-left ${stateClass(flashing, false)} ${pulseClass(pending)}`}
    onClick={onClick}
  >
    <span class="grid size-5 shrink-0 place-items-center">{icon}</span>
    <span class="min-w-0">
      <span class="block text-xs text-fg-dim">{label}</span>
      <span class="block truncate text-base font-medium text-fg">{value}</span>
    </span>
  </ClimateButton>
);

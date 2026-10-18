import type { HassEntity } from 'home-assistant-js-websocket';

export const HVAC_LABEL: Record<string, string> = {
  off: 'Off',
  cool: 'Cool',
  heat: 'Heat',
  dry: 'Dry',
  fan_only: 'Fan',
  auto: 'Auto',
};

/** Limits used when the entity doesn't report its own. */
const DEFAULT_MIN = 16;
const DEFAULT_MAX = 30;
const DEFAULT_STEP = 0.5;

/** `low` → `Low`, `Vertical Swing` → `Swing`; anything else is capitalised. */
export const optionLabel = (value: string) =>
  value === 'Vertical Swing'
    ? 'Swing'
    : value.charAt(0).toUpperCase() + value.slice(1);

export const modeLabel = (mode: string) =>
  HVAC_LABEL[mode] ?? optionLabel(mode);

/** True when the entity exists and HA can act on it. */
export const isUsable = (entity: HassEntity | undefined) =>
  entity !== undefined &&
  entity.state !== 'unavailable' &&
  entity.state !== 'unknown';

const num = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const strings = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];

const text = (value: unknown) =>
  typeof value === 'string' && value !== '' ? value : undefined;

/** What the AC tile and sheet need from the climate entity, with safe fallbacks. */
export type AcView = {
  usable: boolean;
  /** Anything but `off`. */
  on: boolean;
  /** The active mode; when off, the first selectable one. */
  mode: string | undefined;
  /** Selectable modes: the entity's `hvac_modes` without `off`. */
  modes: string[];
  target: number | undefined;
  current: number | undefined;
  fan: string | undefined;
  fanModes: string[];
  swing: string | undefined;
  swingModes: string[];
  min: number;
  max: number;
  step: number;
};

export const readAc = (entity: HassEntity | undefined): AcView => {
  const attrs = entity?.attributes ?? {};
  const usable = isUsable(entity);
  const modes = strings(attrs.hvac_modes).filter((m) => m !== 'off');
  const on = usable && entity!.state !== 'off';
  const step = num(attrs.target_temp_step);
  return {
    usable,
    on,
    mode: on ? entity!.state : modes[0],
    modes,
    target: num(attrs.temperature),
    current: num(attrs.current_temperature),
    fan: text(attrs.fan_mode),
    fanModes: strings(attrs.fan_modes),
    swing: text(attrs.swing_mode),
    swingModes: strings(attrs.swing_modes),
    min: num(attrs.min_temp) ?? DEFAULT_MIN,
    max: num(attrs.max_temp) ?? DEFAULT_MAX,
    step: step && step > 0 ? step : DEFAULT_STEP,
  };
};

/** The target one step up (`1`) or down (`-1`), kept within the limits. */
export const stepTarget = (
  target: number,
  direction: 1 | -1,
  { min, max, step }: Pick<AcView, 'min' | 'max' | 'step'>,
) =>
  Math.min(
    max,
    Math.max(min, Math.round((target + direction * step) * 100) / 100),
  );

/** `24.5`, with as many decimals as the step has (`24.0` for a 0.5 step). */
export const formatTemp = (value: number, step: number) =>
  value.toFixed(String(step).split('.')[1]?.length ?? 0);

const ACTIVITY: Record<string, string> = {
  cool: 'Cooling',
  heat: 'Heating',
  dry: 'Dry mode',
  fan_only: 'Fan only',
  auto: 'Auto mode',
};

/**
 * The line under the sheet's title. `pendingPower` is the power state a tap
 * asked for and HA has not yet confirmed.
 */
export const acStatus = (
  view: Pick<AcView, 'usable' | 'on' | 'mode' | 'fan' | 'fanModes'>,
  pendingPower?: boolean,
) => {
  if (!view.usable) return 'AC unavailable';
  if (pendingPower === true && !view.on) return 'Turning on…';
  if (pendingPower === false && view.on) return 'Turning off…';
  if (!view.on) return 'AC off';
  const activity = (view.mode && ACTIVITY[view.mode]) ?? 'On';
  const fan =
    view.fan === undefined || view.fanModes.length === 0
      ? 'unavailable'
      : optionLabel(view.fan);
  return `${activity} · Fan ${fan}`;
};

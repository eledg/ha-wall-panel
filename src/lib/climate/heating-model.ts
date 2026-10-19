import type { HassEntity } from 'home-assistant-js-websocket';

import { isUsable, num } from '@/services/ha/entity.ts';

/** Where the target comes from, and whether heating is on (see docs/entities.md#heating). */
export type HeatingState = 'schedule' | 'manual' | 'off' | 'paused';

/** Limits used when the entity doesn't report its own. */
const DEFAULT_MIN = 5;
const DEFAULT_MAX = 30;
/** Tado reports no `target_temp_step`; it takes half degrees. */
export const HEATING_STEP = 0.5;

export type HeatingView = {
  /** The climate entity answers and the Tado cloud connection is up. */
  usable: boolean;
  /** Power: the climate entity is in `heat`. */
  on: boolean;
  /** `schedule` when the schedule switch is on; anything else is a manual or off control. */
  following: boolean;
  state: HeatingState;
  /** Boiler demand, home-wide. Only ever true while usable. */
  demand: boolean;
  target: number | undefined;
  /** The living room reading from the Tado sensor. */
  current: number | undefined;
  min: number;
  max: number;
  step: number;
};

/**
 * What the heating tile and sheet need. Control comes from the schedule
 * switch, not `sensor.living_room_zone_mode`, which lags it by seconds and
 * would show a false "Paused" after a manual switch-off.
 */
export const readHeating = (
  climate: HassEntity | undefined,
  schedule: HassEntity | undefined,
  demand: HassEntity | undefined,
  cloud: HassEntity | undefined,
): HeatingView => {
  const attrs = climate?.attributes ?? {};
  // A dropped cloud connection leaves stale data with no error.
  const usable =
    isUsable(climate) && isUsable(schedule) && cloud?.state !== 'off';
  const on = isUsable(climate) && climate!.state !== 'off';
  const following = schedule?.state === 'on';
  const state: HeatingState = on
    ? following
      ? 'schedule'
      : 'manual'
    : following
      ? 'paused'
      : 'off';
  return {
    usable,
    on,
    following,
    state,
    demand: usable && demand?.state === 'on',
    target: num(attrs.temperature),
    current: num(attrs.current_temperature),
    min: num(attrs.min_temp) ?? DEFAULT_MIN,
    max: num(attrs.max_temp) ?? DEFAULT_MAX,
    step: HEATING_STEP,
  };
};

/**
 * Resume returns to the schedule: pressable whenever control isn't already
 * the schedule (Manual and Off). Whether Resume from Off works on the real
 * system is untested.
 */
export const canResume = (view: Pick<HeatingView, 'usable' | 'state'>) =>
  view.usable && (view.state === 'manual' || view.state === 'off');

/** Boost needs heating on and the backend reachable. */
export const canBoost = (view: Pick<HeatingView, 'usable' | 'on'>) =>
  view.usable && view.on;

/** The line under the sheet's title. `pendingPower` is a power change not yet confirmed. */
export const heatingStatus = (
  view: Pick<HeatingView, 'usable' | 'state'>,
  stale: boolean,
  pendingPower?: boolean,
) => {
  if (!view.usable) return 'Heating unavailable';
  if (
    pendingPower === true &&
    view.state !== 'schedule' &&
    view.state !== 'manual'
  ) {
    return 'Turning on…';
  }
  if (
    pendingPower === false &&
    (view.state === 'schedule' || view.state === 'manual')
  ) {
    return 'Turning off…';
  }
  if (stale) return 'Last known readings · stale';
  switch (view.state) {
    case 'paused':
      return 'Heating paused. It will resume automatically.';
    case 'schedule':
      return 'Following schedule';
    case 'manual':
      return 'Manual target';
    case 'off':
      return 'Heating off';
  }
};

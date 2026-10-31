import type { HassEntity } from 'home-assistant-js-websocket';

import { isUsable, num, parseNumber } from '@/services/ha/entity.ts';

/** Where the target comes from, and whether heating is on (see docs/entities.md#heating). */
export type HeatingState = 'schedule' | 'manual' | 'off' | 'paused';

/** Limits used when the entity doesn't report its own. */
const DEFAULT_MIN = 5;
const DEFAULT_MAX = 30;
/** Tado reports no `target_temp_step`; it takes half degrees. */
export const HEATING_STEP = 0.5;

/** How many of the three heat waves are filled. */
export type DemandLevel = 0 | 1 | 2 | 3;

/**
 * Heating power (percent) up to which one, then two, waves are filled; above
 * it, three. Tado doesn't publish its own, so these are the community's
 * reading of its app: 1–33%, 34–66%, 67–100%.
 */
const LEVEL_CEILINGS = [33, 66] as const;

/** The waves for a heating power in percent: none at 0, all three above the last ceiling. */
export const demandLevelOf = (percent: number): DemandLevel => {
  if (percent <= 0) return 0;
  if (percent <= LEVEL_CEILINGS[0]) return 1;
  return percent <= LEVEL_CEILINGS[1] ? 2 : 3;
};

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
  /**
   * Boiler demand in waves. From the `power` sensor when it reads a number,
   * else all or none by `demand`. 0 unless usable.
   */
  demandLevel: DemandLevel;
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
  power?: HassEntity,
): HeatingView => {
  const attrs = climate?.attributes ?? {};
  // A dropped cloud connection leaves stale data with no error.
  const usable =
    isUsable(climate) && isUsable(schedule) && cloud?.state !== 'off';
  const on = isUsable(climate) && climate!.state !== 'off';
  const following = schedule?.state === 'on';
  let state: HeatingState = 'off';
  if (on) state = following ? 'schedule' : 'manual';
  else if (following) state = 'paused';
  const percent = isUsable(power) ? parseNumber(power!.state) : undefined;
  const demanded = usable && demand?.state === 'on';
  let demandLevel: DemandLevel = demanded ? 3 : 0;
  if (usable && percent !== undefined) demandLevel = demandLevelOf(percent);
  return {
    usable,
    on,
    following,
    state,
    demand: demanded,
    demandLevel,
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

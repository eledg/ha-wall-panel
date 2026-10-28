import type { RawHistoryState } from '@/services/ha/history.ts';

/** The four heating states the UI distinguishes (power × control). */
export const HEATING_STATES = ['schedule', 'manual', 'off', 'paused'] as const;
export type MockHeatingState = (typeof HEATING_STATES)[number];

/** The target the schedule sets, which Resume returns to. */
export const SCHEDULED_TARGET = 20;
/** What Boost sets, as Tado does. */
export const BOOST_TARGET = 30;
const MANUAL_TARGET = 20.5;
const ROOM_TEMPERATURE = 19.9;

/** The Tado climate entity's attributes, in the shape the real one reports. */
export const heatingAttributes = (
  target: number | undefined = SCHEDULED_TARGET,
): Record<string, unknown> => ({
  friendly_name: 'Wireless Temperature Sensor X',
  hvac_modes: ['off', 'heat'],
  min_temp: 5,
  max_temp: 30,
  current_temperature: ROOM_TEMPERATURE,
  temperature: target,
  supported_features: 385,
});

/** Power (climate state) and control (schedule switch) for each display state. */
export const heatingFixture = (state: MockHeatingState) => {
  const power = state === 'schedule' || state === 'manual' ? 'heat' : 'off';
  const schedule = state === 'schedule' || state === 'paused' ? 'on' : 'off';
  const target = state === 'manual' ? MANUAL_TARGET : SCHEDULED_TARGET;
  return { power, schedule, target };
};

/** The display state that a climate state and schedule switch state add up to. */
export const heatingStateOf = (
  power: string | undefined,
  schedule: string | undefined,
): MockHeatingState => {
  const scheduled = schedule === 'on';
  if (power === 'heat') return scheduled ? 'schedule' : 'manual';
  return scheduled ? 'paused' : 'off';
};

/**
 * Applies a `climate.*` service to the heating, as HA would: returns the new
 * power, target and whether the schedule still applies, or throws for a
 * value the entity doesn't offer.
 */
export const applyHeatingService = (
  power: string,
  attributes: Record<string, unknown>,
  scheduleOn: boolean,
  service: string,
  data: Record<string, unknown> = {},
): { power: string; target: unknown; scheduleOn: boolean } => {
  const target = attributes.temperature;
  switch (service) {
    case 'set_hvac_mode': {
      const mode = data.hvac_mode;
      if (mode !== 'heat' && mode !== 'off') {
        throw new Error(`Mock HA: ${String(mode)} is not an hvac_mode`);
      }
      // Switching off by hand ends the schedule; coming back keeps the
      // control it had (a pause resumes on its own).
      return {
        power: mode,
        target,
        scheduleOn: mode === 'off' ? false : scheduleOn,
      };
    }
    case 'set_temperature': {
      const temperature = data.temperature;
      const min = attributes.min_temp as number;
      const max = attributes.max_temp as number;
      if (
        typeof temperature !== 'number' ||
        temperature < min ||
        temperature > max ||
        Math.abs(temperature * 2 - Math.round(temperature * 2)) > 1e-9
      ) {
        throw new Error(
          `Mock HA: ${String(temperature)} is not a valid target`,
        );
      }
      // A manual target replaces the schedule.
      return { power, target: temperature, scheduleOn: false };
    }
    default:
      throw new Error(`Mock HA: no service climate.${service}`);
  }
};

/** Six hours of demand: four heating cycles, minutes from the window's start. */
export const DEMAND_BOUNDARIES = [0, 28, 63, 112, 143, 206, 244, 302, 337, 360];

/** The recorded states of the demand sensor over the last six hours. */
export const demandHistory = (now: number): RawHistoryState[] => {
  const start = now - 6 * 3_600_000;
  return DEMAND_BOUNDARIES.slice(0, -1).map((minute, i) => ({
    state: i % 2 === 1 ? 'on' : 'off',
    last_changed: new Date(start + minute * 60_000).toISOString(),
  }));
};

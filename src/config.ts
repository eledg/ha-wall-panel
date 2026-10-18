/** Marks an entity ID that hasn't been confirmed yet (see #13). */
export const PLACEHOLDER_PREFIX = 'TODO:';

export const placeholder = (what: string) => `${PLACEHOLDER_PREFIX}${what}`;

export type EntityDomain =
  | 'binary_sensor'
  | 'button'
  | 'calendar'
  | 'climate'
  | 'sensor'
  | 'switch'
  | 'weather';

type EntitySpec = { domain: EntityDomain; id: string };

const spec = (domain: EntityDomain, id: string): EntitySpec => ({ domain, id });

/** The entities the dashboard needs; add to this each milestone. */
export const config = {
  entities: {
    /** Office light, via the display's relay. A plain switch: no dimming. */
    officeLight: spec('switch', 'switch.shellywallx2i_office'),
    /** Met Office, London: current conditions plus hourly forecast. */
    weather: spec('weather', 'weather.met_office_london'),
    /** Shared family calendar. */
    calendarFamily: spec('calendar', 'calendar.family'),
    /** Formula 1 race weekends. */
    calendarF1: spec('calendar', 'calendar.f1'),
    /** Birthdays: yearly all-day events. */
    calendarBirthdays: spec('calendar', 'calendar.birthdays'),
    /** Office air conditioning: mode, target, fan speed and swing. */
    acClimate: spec(
      'climate',
      'climate.office_climate_air_conditioning_office',
    ),
    /** AC "Powerful" boost. */
    acPowerful: spec(
      'switch',
      'switch.office_climate_air_conditioning_office_powerful',
    ),
    /** AC economy mode. */
    acEconomy: spec(
      'switch',
      'switch.office_climate_air_conditioning_office_economy_mode',
    ),
    /** Office room temperature: Shelly BLU H&T sensor. */
    officeTemperature: spec('sensor', 'sensor.blu_ht_office_temperature'),
    /** Office humidity: the same Shelly BLU H&T sensor. */
    officeHumidity: spec('sensor', 'sensor.blu_ht_office_humidity'),
    /** Battery of the office sensor; shown in the diagnostics screen only. */
    officeBattery: spec('sensor', 'sensor.blu_ht_office_battery'),
    /** AC quiet fan. */
    acQuietFan: spec(
      'switch',
      'switch.office_climate_air_conditioning_office_quiet_fan',
    ),
    /** Central heating (Tado): power (`heat` / `off`), target and room temperature. */
    heatingClimate: spec('climate', 'climate.wireless_temperature_sensor_x'),
    /** Heating control: on follows the schedule, off is manual (or switched off). */
    heatingSchedule: spec('switch', 'switch.living_room_schedule'),
    /** Whether Tado is asking the boiler for heat, for the whole house. */
    heatingDemand: spec(
      'binary_sensor',
      'binary_sensor.tado_home_heating_demand',
    ),
    /** Tado cloud connection: heating data goes stale silently when it drops. */
    heatingCloud: spec(
      'binary_sensor',
      'binary_sensor.tado_temperature_sensor_x_000000_cloud_connection',
    ),
    /** Returns the heating to its schedule. Press-only: the state is never read. */
    heatingResume: spec('button', 'button.living_room_resume_schedule'),
    /** Boosts heating. Press-only: the state is never read. */
    heatingBoost: spec('button', 'button.tado_home_boost_all_zones'),
  },
  /**
   * Night mode (src/night.ts): from `startHour` until `endHour` local time the
   * palette turns warm and dim. It may span midnight. A tap wakes the display
   * for `wakeMs`.
   */
  night: { startHour: 21, endHour: 7, wakeMs: 15_000 },
} as const satisfies {
  entities: Record<string, EntitySpec>;
  night: NightConfig;
};

export type NightConfig = {
  startHour: number;
  endHour: number;
  wakeMs: number;
};

export type Config = {
  entities: Record<string, EntitySpec>;
  night?: NightConfig;
};

export type ConfigIssue = { key: string; message: string };

const ENTITY_ID = /^([a-z_]+)\.([a-z0-9_]+)$/;

/** Returns one issue per missing, placeholder or malformed entity. */
export const validateConfig = (cfg: Config = config): ConfigIssue[] => [
  ...validateEntities(cfg),
  ...validateNight(cfg.night),
];

const validateNight = (night?: NightConfig): ConfigIssue[] => {
  if (!night) return [];
  const hour = (h: number) => Number.isInteger(h) && h >= 0 && h <= 23;
  if (!hour(night.startHour) || !hour(night.endHour))
    return [{ key: 'night', message: 'hours must be whole numbers, 0 to 23' }];
  if (night.startHour === night.endHour)
    return [{ key: 'night', message: 'start and end hours must differ' }];
  if (!(night.wakeMs > 0))
    return [{ key: 'night', message: 'wakeMs must be positive' }];
  return [];
};

const validateEntities = (cfg: Config): ConfigIssue[] =>
  Object.entries(cfg.entities).flatMap(
    ([key, { domain, id }]): ConfigIssue[] => {
      if (id.trim() === '') return [{ key, message: 'entity ID is missing' }];
      if (id.startsWith(PLACEHOLDER_PREFIX))
        return [{ key, message: 'entity ID is still a placeholder' }];
      const match = ENTITY_ID.exec(id);
      if (!match) return [{ key, message: `"${id}" is not a valid entity ID` }];
      if (match[1] !== domain)
        return [{ key, message: `"${id}" should be in the ${domain} domain` }];
      return [];
    },
  );

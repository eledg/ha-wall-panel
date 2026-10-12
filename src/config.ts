/** Marks an entity ID that hasn't been confirmed yet (see #13). */
export const PLACEHOLDER_PREFIX = 'TODO:';

export const placeholder = (what: string) => `${PLACEHOLDER_PREFIX}${what}`;

export type EntityDomain =
  'calendar' | 'climate' | 'sensor' | 'switch' | 'weather';

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
    /** AC quiet fan. */
    acQuietFan: spec(
      'switch',
      'switch.office_climate_air_conditioning_office_quiet_fan',
    ),
  },
  /**
   * Where the Office temperature tile reads from. Today that is the AC's own
   * sensor. To use a separate one, add a `sensor` entity above and point
   * `entity` at it, dropping `attribute` (the state is then the reading).
   */
  temperature: { entity: 'acClimate', attribute: 'current_temperature' },
  /**
   * Night mode (src/night.ts): from `startHour` until `endHour` local time the
   * palette turns warm and dim. It may span midnight. A tap wakes the display
   * for `wakeMs`.
   */
  night: { startHour: 21, endHour: 7, wakeMs: 15_000 },
} as const satisfies {
  entities: Record<string, EntitySpec>;
  temperature: { entity: string; attribute?: string };
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

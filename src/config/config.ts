/** Marks an entity ID that hasn't been filled in yet. */
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

export type EntitySpec = { domain: EntityDomain; id: string };

/**
 * The entities the dashboard needs, and the Home Assistant domain each must be
 * in. The IDs themselves come from `config.json` (see `load.ts`); the domain is
 * fixed here because the app calls domain-specific services on them.
 */
export const ENTITY_DOMAINS = {
  /** A room light, a plain switch: no dimming. */
  light: 'switch',
  /** Current conditions plus hourly forecast. */
  weather: 'weather',
  /** Shared family calendar. */
  calendarFamily: 'calendar',
  /** Formula 1 race weekends. */
  calendarF1: 'calendar',
  /** Birthdays: yearly all-day events. */
  calendarBirthdays: 'calendar',
  /** Air conditioning: mode, target, fan speed and swing. */
  acClimate: 'climate',
  /** AC "Powerful" boost. */
  acPowerful: 'switch',
  /** AC economy mode. */
  acEconomy: 'switch',
  /** AC quiet fan. */
  acQuietFan: 'switch',
  /** Room temperature sensor. */
  roomTemperature: 'sensor',
  /** Room humidity, from the same sensor. */
  roomHumidity: 'sensor',
  /** Battery of the room sensor; shown in the diagnostics screen only. */
  roomBattery: 'sensor',
  /** Central heating: power (`heat` / `off`), target and room temperature. */
  heatingClimate: 'climate',
  /** Heating control: on follows the schedule, off is manual (or switched off). */
  heatingSchedule: 'switch',
  /** Whether the heating is asking the boiler for heat, for the whole house. */
  heatingDemand: 'binary_sensor',
  /** Cloud connection of the heating: its data goes stale silently when it drops. */
  heatingCloud: 'binary_sensor',
  /** Returns the heating to its schedule. Press-only: the state is never read. */
  heatingResume: 'button',
  /** Boosts heating. Press-only: the state is never read. */
  heatingBoost: 'button',
} as const satisfies Record<string, EntityDomain>;

export type EntityKey = keyof typeof ENTITY_DOMAINS;

export const ENTITY_KEYS = Object.keys(ENTITY_DOMAINS) as EntityKey[];

/**
 * Night mode (src/lib/night.ts): from `startHour` until `endHour` local time the
 * palette turns warm and dim. It may span midnight. A tap wakes the display
 * for `wakeMs`.
 */
export type NightConfig = {
  startHour: number;
  endHour: number;
  wakeMs: number;
};

/** Names shown on the tiles and sheets that stand for one room or device. */
export type Labels = { light: string; room: string; ac: string };

export const DEFAULT_NIGHT: NightConfig = {
  startHour: 21,
  endHour: 7,
  wakeMs: 15_000,
};

export const DEFAULT_LABELS: Labels = {
  light: 'Light',
  room: 'Room',
  ac: 'AC',
};

/** What `validateConfig` accepts; looser than `RuntimeConfig` so tests can pass a few entities. */
export type Config = {
  entities: Record<string, EntitySpec>;
  night?: NightConfig;
};

export type RuntimeConfig = {
  entities: Record<EntityKey, EntitySpec>;
  night: NightConfig;
  labels: Labels;
};

export type ConfigIssue = { key: string; message: string };

/** Every entity set to `value(key)`, in its fixed domain. */
export const entitiesFrom = (
  value: (key: EntityKey) => string,
): RuntimeConfig['entities'] =>
  Object.fromEntries(
    ENTITY_KEYS.map((key) => [
      key,
      { domain: ENTITY_DOMAINS[key], id: value(key) },
    ]),
  ) as RuntimeConfig['entities'];

/**
 * The live configuration: all placeholders until `applyConfig` replaces it,
 * once, before the app starts (from `config.json`, or the mock's fixture).
 * Read it through `getConfig` / `entityId` at the point of use, never at
 * import time, when it may not be loaded yet.
 */
let current: RuntimeConfig = {
  entities: entitiesFrom(placeholder),
  night: DEFAULT_NIGHT,
  labels: DEFAULT_LABELS,
};

export const getConfig = () => current;

/** The Home Assistant entity ID configured for `key`. */
export const entityId = (key: EntityKey) => current.entities[key].id;

/** Problems found while reading `config.json`, shown with the live config's own. */
let loadIssues: ConfigIssue[] = [];
/** False when `config.json` could not be read at all, so there is nothing to validate. */
let loaded = true;

export const applyConfig = (
  next: RuntimeConfig,
  issues: ConfigIssue[] = [],
) => {
  current = next;
  loadIssues = issues;
  loaded = true;
};

/** `config.json` could not be read: the entities stay placeholders. */
export const markConfigUnavailable = (message: string) => {
  loadIssues = [{ key: 'config.json', message }];
  loaded = false;
};

const ENTITY_ID = /^([a-z_]+)\.([a-z0-9_]+)$/;

/**
 * Returns one issue per missing, placeholder or malformed entity. For the live
 * config it also reports what went wrong reading `config.json`; if that file
 * could not be read at all, that is the only issue.
 */
export const validateConfig = (cfg: Config = current): ConfigIssue[] => {
  if (cfg !== current)
    return [...validateEntities(cfg), ...validateNight(cfg.night)];
  if (!loaded) return loadIssues;
  return [...loadIssues, ...validateEntities(cfg), ...validateNight(cfg.night)];
};

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

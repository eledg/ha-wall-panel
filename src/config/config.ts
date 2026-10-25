/** Marks an entity ID that hasn't been filled in yet. */
export const PLACEHOLDER_PREFIX = 'TODO:';

export const placeholder = (what: string) => `${PLACEHOLDER_PREFIX}${what}`;

export type EntityDomain =
  | 'binary_sensor'
  | 'button'
  | 'calendar'
  | 'climate'
  | 'sensor'
  | 'sun'
  | 'switch'
  | 'weather';

type RoleSpec = { domain: EntityDomain; optional?: true };

/**
 * The tile types, and the entities ("roles") each one reads. The IDs come from
 * `config.json` (see `load.ts`); the domain of each role is fixed here because
 * the app calls domain-specific services on them. A calendar tile has no roles:
 * it lists its calendars instead (see `CalendarSource`).
 */
export const TILE_ROLES = {
  /** The time and date. */
  clock: {},
  /** Current conditions plus hourly and daily forecasts; `sun` adds sunrise and sunset. */
  weather: {
    entity: { domain: 'weather' },
    sun: { domain: 'sun', optional: true },
  },
  /** One or more calendars, merged into an agenda. */
  calendar: {},
  /** A plain switch, a room light with no dimming. */
  toggle: { entity: { domain: 'switch' } },
  /** A room's temperature and humidity. */
  temperature: {
    temperature: { domain: 'sensor' },
    humidity: { domain: 'sensor' },
    /** Shown in the diagnostics screen only. */
    battery: { domain: 'sensor', optional: true },
  },
  /** Central heating. */
  heating: {
    /** Power (`heat` / `off`), target and room temperature. */
    climate: { domain: 'climate' },
    /** On follows the schedule, off is manual (or switched off). */
    schedule: { domain: 'switch' },
    /** Whether the heating is asking the boiler for heat. */
    demand: { domain: 'binary_sensor' },
    /** Heating power in percent, which grades the heat waves; without it they follow `demand` alone. */
    power: { domain: 'sensor', optional: true },
    /** Cloud connection of the heating: its data goes stale silently when it drops. */
    cloud: { domain: 'binary_sensor' },
    /** Returns the heating to its schedule. Press-only: the state is never read. */
    resume: { domain: 'button' },
    /** Boosts heating. Press-only: the state is never read. */
    boost: { domain: 'button' },
  },
  /** Air conditioning. */
  ac: {
    /** Mode, target, fan speed and swing. */
    climate: { domain: 'climate' },
    powerful: { domain: 'switch' },
    economy: { domain: 'switch' },
    quietFan: { domain: 'switch' },
    /** Room temperature, shown beside the target in the controls. */
    room: { domain: 'sensor', optional: true },
  },
} as const satisfies Record<string, Record<string, RoleSpec>>;

export type TileType = keyof typeof TILE_ROLES;

export const TILE_TYPES = Object.keys(TILE_ROLES) as TileType[];

type Roles<T extends TileType> = (typeof TILE_ROLES)[T];
type OptionalRole<
  T extends TileType,
  R extends keyof Roles<T>,
> = Roles<T>[R] extends { optional: true } ? true : false;

/** The entity IDs of one tile, by role. Optional roles may be absent. */
export type TileEntities<T extends TileType> = {
  [R in keyof Roles<T> as OptionalRole<T, R> extends true ? never : R]: string;
} & {
  [R in keyof Roles<T> as OptionalRole<T, R> extends true ? R : never]?: string;
};

/** Settings every tile may have, besides its entity roles. */
export const COMMON_KEYS = ['id', 'type', 'label', 'col', 'row', 'w', 'h'];

/** Settings beyond the common ones and the entity roles, for the types that have them. */
export const EXTRA_KEYS: Partial<Record<TileType, string[]>> = {
  weather: ['details'],
  calendar: ['calendars'],
  heating: ['roomLabel'],
  ac: ['roomLabel'],
};

/**
 * Calendar colours, named after the palette in `index.css`. The first three
 * are the default rotation for calendars without a `color`, so keep them first.
 */
export const CALENDAR_COLORS = [
  'yellow',
  'blue',
  'green',
  'red',
  'purple',
  'teal',
  'pink',
] as const;
export type CalendarColor = (typeof CALENDAR_COLORS)[number];

/** A rule that rewrites a calendar's event titles: `match` is a regular expression, `replace` its replacement. */
export type TitleRule = { match: string; replace: string };

export type CalendarSource = {
  entity: string;
  label: string;
  color: CalendarColor;
  /** Adds the years since the year in an event's notes, as in "Born 1977", to its title. */
  showYears?: boolean;
  /** Drops the events' descriptions. */
  hideNotes?: boolean;
  /** Shortens the titles shown in the tile's rows. */
  title?: TitleRule;
};

/** The figures the weather screen can show in its stats block, in their default order. */
export const WEATHER_STATS = [
  'wind',
  'feelsLike',
  'humidity',
  'uv',
  'pressure',
  'visibility',
  'dewPoint',
  'sunrise',
  'sunset',
] as const;
export type WeatherStat = (typeof WEATHER_STATS)[number];

/** What the weather screen shows; a weather tile's `details` setting. */
export type WeatherDetailsConfig = {
  /** Days in the outlook, from today; 0 hides it. */
  days: number;
  /** Hours between the columns of the hourly strip. */
  hoursStep: number;
  /** Columns in the hourly strip; 0 hides it. */
  hoursCount: number;
  /** The stat boxes to show, in this order. */
  stats: WeatherStat[];
};

export const DEFAULT_WEATHER_DETAILS: WeatherDetailsConfig = {
  days: 7,
  hoursStep: 3,
  hoursCount: 5,
  stats: [...WEATHER_STATS],
};

/** Inclusive limits of the numeric `details` settings: the forecasts hold 7 days and 48 hours. */
export const WEATHER_DETAILS_LIMITS = {
  days: { min: 0, max: 7 },
  hoursStep: { min: 1, max: 12 },
  hoursCount: { min: 0, max: 8 },
} as const;

/** Where a tile sits on the grid: 1-based column and row, and how many it spans. */
export type Placement = { col: number; row: number; w: number; h: number };

/** The landscape grid. */
export const GRID_COLS = 6;
export const GRID_ROWS = 3;

/** The default name shown on a tile, when its config gives no `label`. */
export const DEFAULT_LABEL: Record<TileType, string> = {
  clock: '',
  weather: 'Weather',
  calendar: 'Calendar',
  toggle: 'Light',
  temperature: 'Room',
  heating: 'Heating',
  ac: 'AC',
};

/** The room named in a sheet's "<room> now" caption, when the config gives no `roomLabel`. */
export const DEFAULT_ROOM_LABEL = 'Room';

export type TileConfig<T extends TileType = TileType> = T extends TileType
  ? Placement & {
      id: string;
      type: T;
      label: string;
      entities: TileEntities<T>;
    } & (T extends 'weather' ? { details: WeatherDetailsConfig } : unknown) &
      (T extends 'calendar' ? { calendars: CalendarSource[] } : unknown) &
      (T extends 'heating' | 'ac' ? { roomLabel: string } : unknown)
  : never;

/**
 * Night mode (src/lib/night.ts): from `startHour` until `endHour` local time the
 * palette turns warm and dim. It may span midnight. A tap wakes the display
 * for `wakeMs`.
 */
export type NightConfig = {
  startHour: number;
  endHour: number;
  wakeMs: number;
  /** While this light is on, night mode is off. Unset by default. */
  overrideSwitch?: string;
};

export const DEFAULT_NIGHT: Omit<NightConfig, 'overrideSwitch'> = {
  startHour: 21,
  endHour: 7,
  wakeMs: 15_000,
};

export type RuntimeConfig = {
  tiles: TileConfig[];
  night: NightConfig;
  /** BCP 47 tag for dates and times; the display's own when unset. */
  locale?: string;
  /** IANA time zone for everything time related; the display's own when unset. */
  timeZone?: string;
};

/** What `validateConfig` accepts: a config whose night settings may be left out. */
export type Config = {
  tiles: TileConfig[];
  night?: NightConfig;
  locale?: string;
  timeZone?: string;
};

/** `key` says where: a tile path such as `tiles[2].climate`, or a top-level setting. */
export type ConfigIssue = { key: string; message: string };

/** One entity a tile reads, with where it was configured. */
export type EntityRef = {
  /** Where in `config.json`, such as `tiles[2].climate`. */
  path: string;
  id: string;
  domain: EntityDomain;
};

const roleSpecs = (type: TileType) =>
  Object.entries(TILE_ROLES[type] as Record<string, RoleSpec>);

/** Every entity the config reads: the tiles' (including calendars) and the night override switch. */
export const entityRefs = (cfg: Config = current): EntityRef[] => [
  ...tileRefs(cfg),
  ...(cfg.night?.overrideSwitch === undefined
    ? []
    : [
        {
          path: 'night.overrideSwitch',
          id: cfg.night.overrideSwitch,
          domain: 'switch' as const,
        },
      ]),
];

const tileRefs = (cfg: Config): EntityRef[] =>
  cfg.tiles.flatMap((tile, index): EntityRef[] => {
    const at = `tiles[${index}]`;
    const entities = tile.entities as Record<string, string | undefined>;
    const roles = roleSpecs(tile.type).flatMap(([role, spec]) => {
      const id = entities[role];
      if (id === undefined && spec.optional) return [];
      return [{ path: `${at}.${role}`, id: id ?? '', domain: spec.domain }];
    });
    const calendars =
      tile.type === 'calendar'
        ? tile.calendars.map((source, n): EntityRef => ({
            path: `${at}.calendars[${n}]`,
            id: source.entity,
            domain: 'calendar',
          }))
        : [];
    return [...roles, ...calendars];
  });

/** The first configured tile of `type`, if there is one. */
export const firstTile = <T extends TileType>(type: T, cfg: Config = current) =>
  cfg.tiles.find((tile) => tile.type === type) as TileConfig<T> | undefined;

/**
 * The live configuration: no tiles until `applyConfig` replaces it, once,
 * before the app starts (from `config.json`, or the mock's fixture). Read it
 * through `getConfig` at the point of use, never at import time, when it may not
 * be loaded yet.
 */
let current: RuntimeConfig = { tiles: [], night: DEFAULT_NIGHT };

export const getConfig = () => current;

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

/** `config.json` could not be read: there are no tiles. */
export const markConfigUnavailable = (message: string) => {
  loadIssues = [{ key: 'config.json', message }];
  loaded = false;
};

const ENTITY_ID = /^([a-z_]+)\.([a-z0-9_]+)$/;

/** What is wrong with one entity ID, or `undefined` when it is usable. */
export const entityProblem = ({ id, domain }: EntityRef) => {
  if (id.trim() === '') return 'entity ID is missing';
  if (id.startsWith(PLACEHOLDER_PREFIX))
    return 'entity ID is still a placeholder';
  const match = ENTITY_ID.exec(id);
  if (!match) return `"${id}" is not a valid entity ID`;
  if (match[1] !== domain) return `"${id}" should be in the ${domain} domain`;
  return undefined;
};

/**
 * Returns one issue per missing, placeholder or malformed entity, plus bad
 * placement and duplicate tile IDs. For the live config it also reports what
 * went wrong reading `config.json`; if that file could not be read at all, that
 * is the only issue.
 */
export const validateConfig = (cfg: Config = current): ConfigIssue[] => {
  const own = [
    ...validateTiles(cfg),
    ...validateEntities(cfg),
    ...validateNight(cfg.night),
  ];
  if (cfg !== current) return own;
  if (!loaded) return loadIssues;
  return [...loadIssues, ...own];
};

const validateNight = (night?: NightConfig): ConfigIssue[] => {
  if (!night) return [];
  const hour = (h: number) => Number.isInteger(h) && h >= 0 && h <= 23;
  if (!hour(night.startHour) || !hour(night.endHour))
    return [{ key: 'night', message: 'hours must be whole numbers, 0 to 23' }];
  if (night.startHour === night.endHour)
    return [{ key: 'night', message: 'start and end hours must differ' }];
  if (Number.isNaN(night.wakeMs) || night.wakeMs <= 0)
    return [{ key: 'night', message: 'wakeMs must be positive' }];
  return [];
};

const validateEntities = (cfg: Config): ConfigIssue[] =>
  entityRefs(cfg).flatMap((ref): ConfigIssue[] => {
    const message = entityProblem(ref);
    return message ? [{ key: ref.path, message }] : [];
  });

const whole = (n: number) => Number.isInteger(n);

const validateTiles = ({ tiles }: Config): ConfigIssue[] => {
  if (tiles.length === 0)
    return [{ key: 'tiles', message: 'no tiles are configured' }];
  const issues: ConfigIssue[] = [];
  const seen = new Set<string>();
  const taken = new Map<string, string>();
  tiles.forEach((tile, index) => {
    const at = `tiles[${index}]`;
    if (seen.has(tile.id))
      issues.push({ key: `${at}.id`, message: `"${tile.id}" is used twice` });
    seen.add(tile.id);

    const { col, row, w, h } = tile;
    const fits =
      [col, row, w, h].every(whole) &&
      col >= 1 &&
      row >= 1 &&
      w >= 1 &&
      h >= 1 &&
      col + w - 1 <= GRID_COLS &&
      row + h - 1 <= GRID_ROWS;
    if (!fits) {
      issues.push({
        key: at,
        message: `must sit inside the ${GRID_COLS} x ${GRID_ROWS} grid (col, row, w and h are whole numbers from 1)`,
      });
      return;
    }
    for (let r = row; r < row + h; r++) {
      for (let c = col; c < col + w; c++) {
        const cell = `${c},${r}`;
        const other = taken.get(cell);
        if (other !== undefined) {
          issues.push({
            key: at,
            message: `overlaps "${other}" at column ${c}, row ${r}`,
          });
          return;
        }
      }
    }
    for (let r = row; r < row + h; r++)
      for (let c = col; c < col + w; c++) taken.set(`${c},${r}`, tile.id);
  });
  return issues;
};

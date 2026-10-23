import {
  applyConfig,
  CALENDAR_COLORS,
  COMMON_KEYS,
  DEFAULT_LABEL,
  DEFAULT_NIGHT,
  DEFAULT_ROOM_LABEL,
  EXTRA_KEYS,
  markConfigUnavailable,
  TILE_ROLES,
  TILE_TYPES,
} from './config.ts';
import type {
  CalendarSource,
  ConfigIssue,
  NightConfig,
  RuntimeConfig,
  TileConfig,
  TileType,
  TitleRule,
} from './config.ts';
import { stripJsonComments } from './jsonc.ts';
import { configUrl } from './url.ts';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const MIGRATION =
  'was replaced by "tiles": list each tile with its type, position and entities (see docs/configuration.md)';

type PlacementKey = 'col' | 'row' | 'w' | 'h';

/**
 * Turns the parsed `config.json` into a config. Anything missing or of the
 * wrong type is reported, and replaced with an empty entity ID (which
 * `validateConfig` then flags) or the default, so one slip never blanks the app.
 */
export const parseConfig = (
  json: unknown,
): { config: RuntimeConfig; issues: ConfigIssue[] } => {
  const issues: ConfigIssue[] = [];
  const problem = (key: string, message: string) =>
    issues.push({ key, message });

  const root = isRecord(json) ? json : {};
  if (!isRecord(json)) problem('config.json', 'must be a JSON object');
  if (root.entities !== undefined) problem('entities', MIGRATION);
  if (root.labels !== undefined)
    problem('labels', 'was replaced by a "label" on each tile');

  const counts = new Map<TileType, number>();
  const tiles: TileConfig[] = [];
  const rawTiles = Array.isArray(root.tiles) ? root.tiles : [];
  if (root.tiles !== undefined && !Array.isArray(root.tiles))
    problem('tiles', 'must be a list of tiles');
  rawTiles.forEach((raw: unknown, index) => {
    const tile = parseTile(raw, `tiles[${index}]`, counts, problem);
    if (tile) tiles.push(tile);
  });

  const night = parseNight(root.night, problem);
  const locale = parseSetting(root, 'locale', isLocale, problem);
  const timeZone = parseSetting(root, 'timeZone', isTimeZone, problem);

  return {
    config: {
      tiles,
      night,
      ...(locale && { locale }),
      ...(timeZone && { timeZone }),
    },
    issues,
  };
};

type Problem = (key: string, message: string) => void;

/** The night settings: the defaults, with any number given in `raw` over them. */
const parseNight = (raw: unknown, problem: Problem): NightConfig => {
  const night: NightConfig = { ...DEFAULT_NIGHT };
  if (raw !== undefined && !isRecord(raw))
    problem('night', 'must be an object');
  const given = isRecord(raw) ? raw : {};
  for (const key of Object.keys(
    DEFAULT_NIGHT,
  ) as (keyof typeof DEFAULT_NIGHT)[]) {
    const value = given[key];
    if (value === undefined) continue;
    if (typeof value === 'number') night[key] = value;
    else problem('night', `${key} must be a number`);
  }
  const sw = given.overrideSwitch;
  if (typeof sw === 'string') night.overrideSwitch = sw;
  else if (sw !== undefined)
    problem('night', 'overrideSwitch must be a string');
  return night;
};

/** A check that `make` accepts the value without throwing. */
const accepts = (make: (value: string) => unknown) => (value: string) => {
  try {
    make(value);
    return true;
  } catch {
    return false;
  }
};

const isLocale = accepts((v) => Intl.getCanonicalLocales(v));
const isTimeZone = accepts(
  (v) => new Intl.DateTimeFormat(undefined, { timeZone: v }),
);

/** An optional top-level string setting that must pass `valid`; reported and ignored otherwise. */
const parseSetting = (
  root: Record<string, unknown>,
  key: 'locale' | 'timeZone',
  valid: (value: string) => boolean,
  problem: Problem,
) => {
  const value = root[key];
  if (value === undefined) return undefined;
  if (typeof value === 'string' && valid(value.trim())) return value.trim();
  problem(
    key,
    key === 'locale'
      ? 'must be a language tag such as "en-GB"'
      : 'must be a time zone name such as "Europe/London"',
  );
  return undefined;
};

/** The member of `options` that `value` equals; otherwise `undefined`, reported unless unset. */
const oneOf = <T extends string>(
  options: readonly T[],
  value: unknown,
  path: string,
  problem: Problem,
): T | undefined => {
  if (value === undefined) return undefined;
  const found = options.find((option) => option === value);
  if (!found) problem(path, `must be one of ${options.join(', ')}`);
  return found;
};

/** A setting that must be a non-empty string, trimmed; `fallback` when unset or wrong. */
const nonEmpty = (
  raw: Record<string, unknown>,
  key: string,
  at: string,
  fallback: string,
  problem: Problem,
) => {
  const value = raw[key];
  if (value === undefined) return fallback;
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  problem(`${at}.${key}`, 'must be a non-empty string');
  return fallback;
};

/** The type-specific settings of a tile: a calendar's sources, a climate tile's room name. */
const parseExtras = (
  raw: Record<string, unknown>,
  type: TileType,
  at: string,
  problem: Problem,
) => {
  if (type === 'calendar')
    return { calendars: parseCalendars(raw.calendars, at, problem) };
  if (type === 'heating' || type === 'ac')
    return {
      roomLabel: nonEmpty(raw, 'roomLabel', at, DEFAULT_ROOM_LABEL, problem),
    };
  return {};
};

/** Reports settings that are not part of a tile of this type. */
const checkKnownKeys = (
  raw: Record<string, unknown>,
  type: TileType,
  at: string,
  problem: Problem,
) => {
  const known = new Set<string>([
    ...COMMON_KEYS,
    ...Object.keys(TILE_ROLES[type]),
    ...(EXTRA_KEYS[type] ?? []),
  ]);
  for (const key of Object.keys(raw)) {
    if (!known.has(key))
      problem(`${at}.${key}`, `is not a setting of a ${type} tile`);
  }
};

/** The entity IDs by role. A missing required one becomes '' so `validateConfig` reports it. */
const parseEntities = (
  raw: Record<string, unknown>,
  type: TileType,
  at: string,
  problem: Problem,
) => {
  const specs = TILE_ROLES[type] as Record<string, { optional?: true }>;
  const entities: Record<string, string> = {};
  for (const [role, spec] of Object.entries(specs)) {
    const value = raw[role];
    if (typeof value === 'string') entities[role] = value;
    else if (value !== undefined)
      problem(`${at}.${role}`, 'entity ID must be a string');
    if (entities[role] === undefined && !spec.optional) entities[role] = '';
  }
  return entities;
};

const parsePlacement = (
  raw: Record<string, unknown>,
  at: string,
  problem: Problem,
) => {
  const number = (key: PlacementKey, fallback: number) => {
    const value = raw[key];
    if (typeof value === 'number') return value;
    if (value !== undefined) problem(`${at}.${key}`, 'must be a number');
    // Position has no default: a tile without one cannot be placed.
    else if (key === 'col' || key === 'row')
      problem(`${at}.${key}`, 'is missing');
    return fallback;
  };
  return {
    col: number('col', 0),
    row: number('row', 0),
    w: number('w', 1),
    h: number('h', 1),
  };
};

const parseTile = (
  raw: unknown,
  at: string,
  counts: Map<TileType, number>,
  problem: Problem,
): TileConfig | undefined => {
  if (!isRecord(raw)) {
    problem(at, 'must be an object');
    return undefined;
  }
  const type = TILE_TYPES.find((t) => t === raw.type);
  if (!type) {
    problem(
      `${at}.type`,
      `must be one of ${TILE_TYPES.join(', ')} (got ${JSON.stringify(raw.type)})`,
    );
    return undefined;
  }

  checkKnownKeys(raw, type, at, problem);
  const count = (counts.get(type) ?? 0) + 1;
  counts.set(type, count);
  const tile = {
    id: nonEmpty(raw, 'id', at, `${type}-${count}`, problem),
    type,
    label: nonEmpty(raw, 'label', at, DEFAULT_LABEL[type], problem),
    entities: parseEntities(raw, type, at, problem),
    ...parsePlacement(raw, at, problem),
    ...parseExtras(raw, type, at, problem),
  };
  return tile as TileConfig;
};

const CALENDAR_KEYS = new Set([
  'entity',
  'label',
  'color',
  'showYears',
  'hideNotes',
  'title',
]);

/** An optional true/false setting; reported and ignored when it is anything else. */
const optionalBoolean = (value: unknown, path: string, problem: Problem) => {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  problem(path, 'must be true or false');
  return undefined;
};

/** A title rule needs a `match` that compiles as a regular expression and a `replace`. */
const parseTitleRule = (
  value: unknown,
  path: string,
  problem: Problem,
): TitleRule | undefined => {
  if (value === undefined) return undefined;
  if (
    !isRecord(value) ||
    typeof value.match !== 'string' ||
    typeof value.replace !== 'string'
  ) {
    problem(path, 'must be an object with a "match" and a "replace" string');
    return undefined;
  }
  try {
    new RegExp(value.match, 'u');
  } catch {
    problem(`${path}.match`, 'must be a valid regular expression');
    return undefined;
  }
  return { match: value.match, replace: value.replace };
};

const parseCalendar = (
  item: Record<string, unknown>,
  path: string,
  n: number,
  problem: Problem,
): CalendarSource => {
  for (const key of Object.keys(item)) {
    if (!CALENDAR_KEYS.has(key))
      problem(`${path}.${key}`, 'is not a setting of a calendar');
  }
  if (item.entity !== undefined && typeof item.entity !== 'string')
    problem(`${path}.entity`, 'entity ID must be a string');
  if (item.label !== undefined && typeof item.label !== 'string')
    problem(`${path}.label`, 'must be a string');

  const color =
    oneOf(CALENDAR_COLORS, item.color, `${path}.color`, problem) ??
    CALENDAR_COLORS[n % CALENDAR_COLORS.length]!;
  const showYears = optionalBoolean(
    item.showYears,
    `${path}.showYears`,
    problem,
  );
  const hideNotes = optionalBoolean(
    item.hideNotes,
    `${path}.hideNotes`,
    problem,
  );
  const title = parseTitleRule(item.title, `${path}.title`, problem);
  return {
    entity: typeof item.entity === 'string' ? item.entity : '',
    label: typeof item.label === 'string' ? item.label.trim() : '',
    color,
    ...(showYears && { showYears }),
    ...(hideNotes && { hideNotes }),
    ...(title && { title }),
  };
};

const parseCalendars = (
  raw: unknown,
  at: string,
  problem: Problem,
): CalendarSource[] => {
  if (!Array.isArray(raw)) {
    problem(`${at}.calendars`, 'must be a list of calendars');
    return [];
  }
  return raw.map((item: unknown, n): CalendarSource => {
    const path = `${at}.calendars[${n}]`;
    if (isRecord(item)) return parseCalendar(item, path, n, problem);
    problem(path, 'must be an object with an "entity"');
    return { entity: '', label: '', color: CALENDAR_COLORS[0] };
  });
};

/** Fetches and applies `config.json`. Never throws: a failure becomes an issue. */
export const loadConfig = async (
  url: string = configUrl(location.pathname),
  fetchFn: typeof fetch = fetch,
) => {
  try {
    // HA serves /local/ with long cache headers; an edited config must show at once.
    const response = await fetchFn(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { config, issues } = parseConfig(
      JSON.parse(stripJsonComments(await response.text())),
    );
    applyConfig(config, issues);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    markConfigUnavailable(`could not read ${url}: ${reason}`);
  }
};

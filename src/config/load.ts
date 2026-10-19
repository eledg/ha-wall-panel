import {
  applyConfig,
  CALENDAR_COLORS,
  CALENDAR_KINDS,
  DEFAULT_LABEL,
  DEFAULT_NIGHT,
  markConfigUnavailable,
  TILE_ROLES,
  TILE_TYPES,
} from './config.ts';
import type {
  CalendarColor,
  CalendarKind,
  CalendarSource,
  ConfigIssue,
  NightConfig,
  RuntimeConfig,
  TileConfig,
  TileType,
} from './config.ts';
import { configUrl } from './url.ts';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const MIGRATION =
  'was replaced by "tiles": list each tile with its type, position and entities (see docs/configuration.md)';

const PLACEMENT_KEYS = ['col', 'row', 'w', 'h'] as const;
const COMMON_KEYS = ['id', 'type', 'label', ...PLACEMENT_KEYS];

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

  const night = { ...DEFAULT_NIGHT };
  if (root.night !== undefined && !isRecord(root.night))
    problem('night', 'must be an object');
  const rawNight = isRecord(root.night) ? root.night : {};
  for (const key of Object.keys(DEFAULT_NIGHT) as (keyof NightConfig)[]) {
    const value = rawNight[key];
    if (value === undefined) continue;
    if (typeof value === 'number') night[key] = value;
    else problem('night', `${key} must be a number`);
  }

  return { config: { tiles, night }, issues };
};

const parseTile = (
  raw: unknown,
  at: string,
  counts: Map<TileType, number>,
  problem: (key: string, message: string) => void,
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

  const roles = Object.keys(TILE_ROLES[type]);
  const known = [
    ...COMMON_KEYS,
    ...roles,
    ...(type === 'calendar' ? ['calendars'] : []),
  ];
  for (const key of Object.keys(raw)) {
    if (!known.includes(key))
      problem(`${at}.${key}`, `is not a setting of a ${type} tile`);
  }

  const count = (counts.get(type) ?? 0) + 1;
  counts.set(type, count);
  let id = `${type}-${count}`;
  if (raw.id !== undefined) {
    if (typeof raw.id === 'string' && raw.id.trim() !== '') id = raw.id.trim();
    else problem(`${at}.id`, 'must be a non-empty string');
  }

  let label = DEFAULT_LABEL[type];
  if (raw.label !== undefined) {
    if (typeof raw.label === 'string' && raw.label.trim() !== '')
      label = raw.label.trim();
    else problem(`${at}.label`, 'must be a non-empty string');
  }

  const number = (key: (typeof PLACEMENT_KEYS)[number], fallback: number) => {
    const value = raw[key];
    if (value === undefined) {
      // Position has no default: a tile without one cannot be placed.
      if (key === 'col' || key === 'row') problem(`${at}.${key}`, 'is missing');
      return fallback;
    }
    if (typeof value === 'number') return value;
    problem(`${at}.${key}`, 'must be a number');
    return fallback;
  };

  const entities: Record<string, string> = {};
  for (const role of roles) {
    const value = raw[role];
    if (value === undefined) continue;
    if (typeof value === 'string') entities[role] = value;
    else problem(`${at}.${role}`, 'entity ID must be a string');
  }
  // A missing required role becomes '' so `validateConfig` reports it.
  const specs = TILE_ROLES[type] as Record<string, { optional?: true }>;
  for (const role of roles) {
    if (entities[role] === undefined && !specs[role]?.optional)
      entities[role] = '';
  }

  const tile = {
    id,
    type,
    label,
    col: number('col', 0),
    row: number('row', 0),
    w: number('w', 1),
    h: number('h', 1),
    entities,
    ...(type === 'calendar'
      ? { calendars: parseCalendars(raw.calendars, at, problem) }
      : {}),
  };
  return tile as TileConfig;
};

const parseCalendars = (
  raw: unknown,
  at: string,
  problem: (key: string, message: string) => void,
): CalendarSource[] => {
  if (!Array.isArray(raw)) {
    problem(`${at}.calendars`, 'must be a list of calendars');
    return [];
  }
  return raw.map((item: unknown, n): CalendarSource => {
    const path = `${at}.calendars[${n}]`;
    if (!isRecord(item)) {
      problem(path, 'must be an object with an "entity"');
      return { entity: '', label: '', color: CALENDAR_COLORS[0] };
    }
    const entity = typeof item.entity === 'string' ? item.entity : '';
    if (item.entity !== undefined && typeof item.entity !== 'string')
      problem(`${path}.entity`, 'entity ID must be a string');

    let label = '';
    if (item.label !== undefined) {
      if (typeof item.label === 'string') label = item.label.trim();
      else problem(`${path}.label`, 'must be a string');
    }

    let color: CalendarColor = CALENDAR_COLORS[n % CALENDAR_COLORS.length]!;
    if (item.color !== undefined) {
      const named = CALENDAR_COLORS.find((c) => c === item.color);
      if (named) color = named;
      else
        problem(
          `${path}.color`,
          `must be one of ${CALENDAR_COLORS.join(', ')}`,
        );
    }
    let kind: CalendarKind | undefined;
    if (item.kind !== undefined) {
      kind = CALENDAR_KINDS.find((k) => k === item.kind);
      if (!kind)
        problem(`${path}.kind`, `must be one of ${CALENDAR_KINDS.join(', ')}`);
    }
    return { entity, label, color, ...(kind && { kind }) };
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
    const { config, issues } = parseConfig(await response.json());
    applyConfig(config, issues);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    markConfigUnavailable(`could not read ${url}: ${reason}`);
  }
};

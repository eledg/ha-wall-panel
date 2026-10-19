import {
  applyConfig,
  DEFAULT_LABELS,
  DEFAULT_NIGHT,
  entitiesFrom,
  ENTITY_DOMAINS,
  markConfigUnavailable,
} from './config.ts';
import type {
  ConfigIssue,
  Labels,
  NightConfig,
  RuntimeConfig,
} from './config.ts';
import { configUrl } from './url.ts';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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

  const rawEntities = isRecord(root.entities) ? root.entities : {};
  if (root.entities !== undefined && !isRecord(root.entities))
    problem('entities', 'must be an object of entity IDs');
  for (const key of Object.keys(rawEntities)) {
    if (!(key in ENTITY_DOMAINS)) problem(key, 'is not an entity the app uses');
  }
  const entities = entitiesFrom((key) => {
    const id = rawEntities[key];
    if (id !== undefined && typeof id !== 'string')
      problem(key, 'entity ID must be a string');
    return typeof id === 'string' ? id : '';
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

  const labels = { ...DEFAULT_LABELS };
  if (root.labels !== undefined && !isRecord(root.labels))
    problem('labels', 'must be an object');
  const rawLabels = isRecord(root.labels) ? root.labels : {};
  for (const key of Object.keys(DEFAULT_LABELS) as (keyof Labels)[]) {
    const value = rawLabels[key];
    if (value === undefined) continue;
    if (typeof value === 'string' && value.trim() !== '')
      labels[key] = value.trim();
    else problem('labels', `${key} must be a non-empty string`);
  }

  return { config: { entities, night, labels }, issues };
};

/** Fetches and applies `config.json`. Never throws: a failure becomes an issue. */
export const loadConfig = async (
  url: string = configUrl(import.meta.env.BASE_URL),
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

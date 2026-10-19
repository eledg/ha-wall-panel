import { afterEach, describe, expect, it, vi } from 'vitest';

import { mockConfig } from '@/dev/mock/config.ts';

import { applyConfig, firstTile, getConfig, validateConfig } from './config.ts';
import type { RuntimeConfig } from './config.ts';
import type * as Load from './load.ts';

// The test setup stubs `loadConfig` for the app; these tests need the real one.
const { loadConfig, parseConfig } =
  await vi.importActual<typeof Load>('./load.ts');

const respond = (body: unknown, init: ResponseInit = {}) =>
  vi.fn(async () => new Response(JSON.stringify(body), init));

/** The runtime config as `config.json` spells it: entities sit beside the settings. */
const toFile = ({ tiles, night }: RuntimeConfig) => ({
  night,
  tiles: tiles.map(({ entities, label, ...tile }) => ({
    ...tile,
    ...(label !== '' && { label }),
    ...entities,
  })),
});

const toggleTile = {
  type: 'toggle',
  col: 1,
  row: 1,
  entity: 'switch.desk_lamp',
};

afterEach(() => applyConfig(mockConfig));

describe('parseConfig', () => {
  it('reads the fixture config back unchanged, with no issues', () => {
    const { config, issues } = parseConfig(
      JSON.parse(JSON.stringify(toFile(mockConfig))),
    );

    expect(issues).toEqual([]);
    expect(config).toEqual(mockConfig);
  });

  it('reads a minimal tile and fills in the defaults', () => {
    const { config, issues } = parseConfig({ tiles: [toggleTile] });

    expect(issues).toEqual([]);
    expect(config.tiles).toEqual([
      {
        id: 'toggle-1',
        type: 'toggle',
        label: 'Light',
        col: 1,
        row: 1,
        w: 1,
        h: 1,
        entities: { entity: 'switch.desk_lamp' },
      },
    ]);
    expect(config.night).toEqual({ startHour: 21, endHour: 7, wakeMs: 15_000 });
  });

  it('numbers the default ids per type, so several tiles of a type are fine', () => {
    const { config } = parseConfig({
      tiles: [
        toggleTile,
        { ...toggleTile, col: 2 },
        { type: 'clock', col: 3, row: 1 },
        { ...toggleTile, col: 4, id: 'porch' },
      ],
    });

    expect(config.tiles.map((t) => t.id)).toEqual([
      'toggle-1',
      'toggle-2',
      'clock-1',
      'porch',
    ]);
  });

  it('takes label, size and night hours when given', () => {
    const { config, issues } = parseConfig({
      tiles: [{ ...toggleTile, label: ' Desk ', w: 2, h: 3 }],
      night: { startHour: 22 },
    });

    expect(issues).toEqual([]);
    expect(config.tiles[0]).toMatchObject({ label: 'Desk', w: 2, h: 3 });
    expect(config.night).toEqual({ startHour: 22, endHour: 7, wakeMs: 15_000 });
  });

  it('leaves a missing required entity empty, so validation flags it', () => {
    const { config } = parseConfig({
      tiles: [{ type: 'toggle', col: 1, row: 1 }],
    });

    expect(config.tiles[0]?.entities).toEqual({ entity: '' });
    expect(validateConfig(config)).toContainEqual({
      key: 'tiles[0].entity',
      message: 'entity ID is missing',
    });
  });

  it('keeps an optional entity out when it is not given', () => {
    const { config } = parseConfig({
      tiles: [
        {
          type: 'temperature',
          col: 1,
          row: 1,
          temperature: 'sensor.t',
          humidity: 'sensor.h',
        },
      ],
    });

    expect(config.tiles[0]?.entities).toEqual({
      temperature: 'sensor.t',
      humidity: 'sensor.h',
    });
  });

  it('reads calendars, with colours by position and kinds', () => {
    const { config, issues } = parseConfig({
      tiles: [
        {
          type: 'calendar',
          col: 1,
          row: 1,
          calendars: [
            { entity: 'calendar.a', label: 'A' },
            { entity: 'calendar.b', color: 'green', kind: 'f1' },
          ],
        },
      ],
    });

    expect(issues).toEqual([]);
    expect(config.tiles[0]).toMatchObject({
      calendars: [
        { entity: 'calendar.a', label: 'A', color: 'yellow' },
        { entity: 'calendar.b', label: '', color: 'green', kind: 'f1' },
      ],
    });
  });

  it('reports bad calendars', () => {
    const { issues } = parseConfig({
      tiles: [
        {
          type: 'calendar',
          col: 1,
          row: 1,
          calendars: [
            { entity: 5 },
            { entity: 'calendar.b', color: 'pink', kind: 'x' },
            'calendar.c',
          ],
        },
        { type: 'calendar', col: 2, row: 1 },
      ],
    });

    expect(issues).toEqual([
      {
        key: 'tiles[0].calendars[0].entity',
        message: 'entity ID must be a string',
      },
      {
        key: 'tiles[0].calendars[1].color',
        message: 'must be one of yellow, blue, green',
      },
      {
        key: 'tiles[0].calendars[1].kind',
        message: 'must be one of f1, birthdays',
      },
      {
        key: 'tiles[0].calendars[2]',
        message: 'must be an object with an "entity"',
      },
      { key: 'tiles[1].calendars', message: 'must be a list of calendars' },
    ]);
  });

  it('drops a tile of an unknown type and says so', () => {
    const { config, issues } = parseConfig({
      tiles: [{ type: 'doorbell', col: 1, row: 1 }, toggleTile],
    });

    expect(config.tiles).toHaveLength(1);
    expect(issues).toEqual([
      {
        key: 'tiles[0].type',
        message:
          'must be one of clock, weather, calendar, toggle, temperature, heating, ac (got "doorbell")',
      },
    ]);
  });

  it('reports settings a tile does not have, and values of the wrong type', () => {
    const { issues } = parseConfig({
      tiles: [
        { ...toggleTile, entiti: 'x', col: 'one', label: '', id: 3 },
        { type: 'toggle', row: 1, entity: 7 },
      ],
      night: { wakeMs: 'soon' },
    });

    expect(issues).toEqual([
      { key: 'tiles[0].entiti', message: 'is not a setting of a toggle tile' },
      { key: 'tiles[0].id', message: 'must be a non-empty string' },
      { key: 'tiles[0].label', message: 'must be a non-empty string' },
      { key: 'tiles[0].col', message: 'must be a number' },
      { key: 'tiles[1].entity', message: 'entity ID must be a string' },
      { key: 'tiles[1].col', message: 'is missing' },
      { key: 'night', message: 'wakeMs must be a number' },
    ]);
  });

  it('points a config in the old format at the new one', () => {
    const { config, issues } = parseConfig({
      entities: { light: 'switch.wall_light' },
      labels: { light: 'Light' },
    });

    expect(config.tiles).toEqual([]);
    expect(issues.map(({ key }) => key)).toEqual(['entities', 'labels']);
    expect(issues[0]?.message).toMatch(/replaced by "tiles"/);
  });

  it('rejects something that is not an object, and tiles that are not a list', () => {
    expect(parseConfig([]).issues[0]).toEqual({
      key: 'config.json',
      message: 'must be a JSON object',
    });
    expect(parseConfig({ tiles: {} }).issues).toEqual([
      { key: 'tiles', message: 'must be a list of tiles' },
    ]);
    expect(parseConfig({ tiles: [5] }).issues).toEqual([
      { key: 'tiles[0]', message: 'must be an object' },
    ]);
  });
});

describe('loadConfig', () => {
  it('applies the fetched config', async () => {
    const fetchFn = respond({
      tiles: [{ ...toggleTile, label: 'Desk lamp' }],
    });

    await loadConfig('/local/wall.config.json', fetchFn as typeof fetch);

    expect(fetchFn).toHaveBeenCalledWith('/local/wall.config.json', {
      cache: 'no-store',
    });
    expect(firstTile('toggle')?.entities.entity).toBe('switch.desk_lamp');
    expect(getConfig().tiles[0]?.label).toBe('Desk lamp');
    expect(validateConfig()).toEqual([]);
  });

  it('reports a missing file instead of throwing', async () => {
    const fetchFn = respond({}, { status: 404 });

    await loadConfig('/x.json', fetchFn as typeof fetch);

    expect(validateConfig()).toEqual([
      { key: 'config.json', message: 'could not read /x.json: HTTP 404' },
    ]);
  });

  it('reports invalid JSON and network errors', async () => {
    await loadConfig(
      '/x.json',
      (async () => new Response('{ nope')) as typeof fetch,
    );
    expect(validateConfig()[0]?.message).toMatch(/could not read \/x\.json/);

    await loadConfig('/x.json', (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch);
    expect(validateConfig()).toEqual([
      {
        key: 'config.json',
        message: 'could not read /x.json: Failed to fetch',
      },
    ]);
  });
});

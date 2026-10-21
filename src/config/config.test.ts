import { afterEach, describe, expect, it } from 'vitest';

import { mockConfig } from '@/dev/mock/config.ts';
import { tileOf } from '@/tests/ids.ts';

import {
  applyConfig,
  DEFAULT_NIGHT,
  entityRefs,
  firstTile,
  getConfig,
  markConfigUnavailable,
  placeholder,
  validateConfig,
} from './config.ts';
import type { Config, TileConfig } from './config.ts';

const toggle = (patch: Partial<TileConfig<'toggle'>> = {}): TileConfig =>
  ({ ...tileOf('toggle'), ...patch }) as TileConfig;

const withTiles = (...tiles: TileConfig[]): Config => ({ tiles });

describe('getConfig and firstTile', () => {
  afterEach(() => applyConfig(mockConfig));

  it('read the config that was applied last', () => {
    expect(firstTile('toggle')?.entities.entity).toBe('switch.wall_light');

    applyConfig({
      ...mockConfig,
      tiles: [toggle({ entities: { entity: 'switch.desk' } })],
    });

    expect(getConfig().tiles).toHaveLength(1);
    expect(firstTile('toggle')?.entities.entity).toBe('switch.desk');
    expect(firstTile('ac')).toBeUndefined();
  });
});

describe('entityRefs', () => {
  it('lists every entity a tile reads, calendars included, skipping unset optional ones', () => {
    const refs = entityRefs(
      withTiles(tileOf('temperature'), tileOf('calendar')),
    );

    expect(refs.map(({ path }) => path)).toEqual([
      'tiles[0].temperature',
      'tiles[0].humidity',
      'tiles[0].battery',
      'tiles[1].calendars[0]',
      'tiles[1].calendars[1]',
      'tiles[1].calendars[2]',
    ]);

    const { battery: _omitted, ...entities } = tileOf('temperature').entities;
    const without = entityRefs(
      withTiles({ ...tileOf('temperature'), entities }),
    );
    expect(without.map(({ path }) => path)).toEqual([
      'tiles[0].temperature',
      'tiles[0].humidity',
    ]);
  });
});

describe('validateConfig', () => {
  it('accepts the fixture config', () => {
    expect(validateConfig(getConfig())).toEqual([]);
  });

  it('flags a config with no tiles', () => {
    expect(validateConfig(withTiles())).toEqual([
      { key: 'tiles', message: 'no tiles are configured' },
    ]);
  });

  it('flags every entity of tiles that are all placeholders', () => {
    const tiles = mockConfig.tiles.map((tile) =>
      tile.type === 'toggle'
        ? { ...tile, entities: { entity: placeholder('light') } }
        : tile,
    );

    const issues = validateConfig({ tiles });

    expect(issues).toEqual([
      { key: 'tiles[3].entity', message: 'entity ID is still a placeholder' },
    ]);
  });

  it('reports only that config.json is unreadable when it could not be read', () => {
    markConfigUnavailable('could not read /x: HTTP 404');

    expect(validateConfig()).toEqual([
      { key: 'config.json', message: 'could not read /x: HTTP 404' },
    ]);
    applyConfig(mockConfig);
    expect(validateConfig()).toEqual([]);
  });

  it('adds problems found while reading to the live config issues', () => {
    applyConfig(mockConfig, [{ key: 'night', message: 'must be an object' }]);

    expect(validateConfig()).toEqual([
      { key: 'night', message: 'must be an object' },
    ]);
    applyConfig(mockConfig);
  });

  it('flags a missing entity', () => {
    const issues = validateConfig(
      withTiles(toggle({ entities: { entity: ' ' } })),
    );

    expect(issues).toEqual([
      { key: 'tiles[0].entity', message: 'entity ID is missing' },
    ]);
  });

  it('flags a malformed entity ID', () => {
    const issues = validateConfig(
      withTiles(toggle({ entities: { entity: 'Switch Office' } })),
    );

    expect(issues[0]?.message).toMatch(/not a valid entity ID/);
  });

  it('flags an entity in the wrong domain', () => {
    const issues = validateConfig(
      withTiles(toggle({ entities: { entity: 'sensor.office' } })),
    );

    expect(issues[0]?.message).toMatch(/switch domain/);
  });

  it('flags a calendar in the wrong domain', () => {
    const calendar = tileOf('calendar');
    const issues = validateConfig(
      withTiles({
        ...calendar,
        calendars: [{ entity: 'switch.family', label: 'F', color: 'blue' }],
      }),
    );

    expect(issues).toEqual([
      {
        key: 'tiles[0].calendars[0]',
        message: '"switch.family" should be in the calendar domain',
      },
    ]);
  });

  it('flags a tile that does not fit the grid', () => {
    for (const patch of [
      { col: 0 },
      { row: 4 },
      { col: 6, w: 2 },
      { row: 3, h: 2 },
      { w: 0 },
      { col: 1.5 },
    ]) {
      expect(validateConfig(withTiles(toggle(patch)))).toEqual([
        {
          key: 'tiles[0]',
          message:
            'must sit inside the 6 x 3 grid (col, row, w and h are whole numbers from 1)',
        },
      ]);
    }
  });

  it('accepts a tile that fills the whole grid', () => {
    expect(
      validateConfig(withTiles(toggle({ col: 1, row: 1, w: 6, h: 3 }))),
    ).toEqual([]);
  });

  it('flags tiles that overlap', () => {
    const issues = validateConfig(
      withTiles(
        toggle({ id: 'a', col: 1, row: 1, w: 2, h: 2 }),
        toggle({ id: 'b', col: 2, row: 2, w: 2, h: 1 }),
      ),
    );

    expect(issues).toEqual([
      { key: 'tiles[1]', message: 'overlaps "a" at column 2, row 2' },
    ]);
  });

  it('allows tiles that touch', () => {
    expect(
      validateConfig(
        withTiles(
          toggle({ id: 'a', col: 1, row: 1, w: 2 }),
          toggle({ id: 'b', col: 3, row: 1 }),
          toggle({ id: 'c', col: 1, row: 2 }),
        ),
      ),
    ).toEqual([]);
  });

  it('flags a tile id used twice', () => {
    const issues = validateConfig(
      withTiles(
        toggle({ id: 'x', col: 1, w: 1 }),
        toggle({ id: 'x', col: 2, w: 1 }),
      ),
    );

    expect(issues).toEqual([
      { key: 'tiles[1].id', message: '"x" is used twice' },
    ]);
  });

  it('checks the night settings', () => {
    expect(
      validateConfig({
        ...mockConfig,
        night: { startHour: 7, endHour: 7, wakeMs: 1 },
      }),
    ).toEqual([{ key: 'night', message: 'start and end hours must differ' }]);
    expect(
      validateConfig({
        ...mockConfig,
        night: { startHour: 24, endHour: 7, wakeMs: 1 },
      })[0]?.message,
    ).toMatch(/0 to 23/);
    expect(
      validateConfig({
        ...mockConfig,
        night: { startHour: 21, endHour: 7, wakeMs: 0 },
      })[0]?.message,
    ).toMatch(/positive/);
  });

  it('checks the night override switch like any entity', () => {
    const withLight = (overrideSwitch: string) =>
      validateConfig({
        ...mockConfig,
        night: { ...DEFAULT_NIGHT, overrideSwitch },
      });
    expect(withLight('switch.office')).toEqual([]);
    expect(validateConfig({ ...mockConfig, night: DEFAULT_NIGHT })).toEqual([]);
    expect(withLight('office')).toEqual([
      {
        key: 'night.overrideSwitch',
        message: '"office" is not a valid entity ID',
      },
    ]);
    expect(withLight('sensor.office')).toEqual([
      {
        key: 'night.overrideSwitch',
        message: '"sensor.office" should be in the switch domain',
      },
    ]);
  });
});

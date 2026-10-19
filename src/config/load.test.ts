import { afterEach, describe, expect, it, vi } from 'vitest';

import { mockConfig } from '@/dev/mock/config.ts';

import { applyConfig, entityId, getConfig, validateConfig } from './config.ts';
import type * as Load from './load.ts';

// The test setup stubs `loadConfig` for the app; these tests need the real one.
const { loadConfig, parseConfig } =
  await vi.importActual<typeof Load>('./load.ts');

const ids = Object.fromEntries(
  Object.entries(mockConfig.entities).map(([key, { id }]) => [key, id]),
);

const respond = (body: unknown, init: ResponseInit = {}) =>
  vi.fn(async () => new Response(JSON.stringify(body), init));

afterEach(() => applyConfig(mockConfig));

describe('parseConfig', () => {
  it('reads entity IDs, and defaults night and labels', () => {
    const { config: parsed, issues } = parseConfig({ entities: ids });

    expect(issues).toEqual([]);
    expect(parsed.entities.light).toEqual({
      domain: 'switch',
      id: 'switch.wall_light',
    });
    expect(parsed.night).toEqual({ startHour: 21, endHour: 7, wakeMs: 15_000 });
    expect(parsed.labels).toEqual({ light: 'Light', room: 'Room', ac: 'AC' });
  });

  it('takes night hours and labels when given', () => {
    const { config: parsed, issues } = parseConfig({
      entities: ids,
      night: { startHour: 22 },
      labels: { room: ' Study ' },
    });

    expect(issues).toEqual([]);
    expect(parsed.night).toEqual({ startHour: 22, endHour: 7, wakeMs: 15_000 });
    expect(parsed.labels.room).toBe('Study');
  });

  it('leaves a missing entity empty, so validation flags it', () => {
    const { light: _omitted, ...rest } = ids;
    const { config: parsed } = parseConfig({ entities: rest });

    expect(parsed.entities.light.id).toBe('');
    expect(validateConfig(parsed)).toContainEqual({
      key: 'light',
      message: 'entity ID is missing',
    });
  });

  it('reports unknown keys and values of the wrong type', () => {
    const { issues } = parseConfig({
      entities: { ...ids, sofa: 'switch.sofa', weather: 5 },
      night: { wakeMs: 'soon' },
      labels: { ac: '' },
    });

    expect(issues).toEqual([
      { key: 'sofa', message: 'is not an entity the app uses' },
      { key: 'weather', message: 'entity ID must be a string' },
      { key: 'night', message: 'wakeMs must be a number' },
      { key: 'labels', message: 'ac must be a non-empty string' },
    ]);
  });

  it('rejects something that is not an object', () => {
    expect(parseConfig([]).issues[0]).toEqual({
      key: 'config.json',
      message: 'must be a JSON object',
    });
  });
});

describe('loadConfig', () => {
  it('applies the fetched config', async () => {
    const fetchFn = respond({
      entities: { ...ids, light: 'switch.desk_lamp' },
      labels: { light: 'Desk lamp' },
    });

    await loadConfig('/local/wall.config.json', fetchFn as typeof fetch);

    expect(fetchFn).toHaveBeenCalledWith('/local/wall.config.json', {
      cache: 'no-store',
    });
    expect(entityId('light')).toBe('switch.desk_lamp');
    expect(getConfig().labels.light).toBe('Desk lamp');
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

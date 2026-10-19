import { afterEach, describe, expect, it } from 'vitest';

import { mockConfig } from '@/dev/mock/config.ts';

import {
  applyConfig,
  entitiesFrom,
  entityId,
  getConfig,
  markConfigUnavailable,
  placeholder,
  validateConfig,
} from './config.ts';

const withEntities = (
  entities: Record<
    string,
    { domain: 'climate' | 'sensor' | 'switch'; id: string }
  >,
) => ({
  entities,
});

describe('getConfig and entityId', () => {
  afterEach(() => applyConfig(mockConfig));

  it('read the config that was applied last', () => {
    expect(entityId('light')).toBe('switch.wall_light');

    applyConfig({
      ...mockConfig,
      entities: entitiesFrom((key) => `sensor.${key.toLowerCase()}`),
    });

    expect(entityId('light')).toBe('sensor.light');
    expect(getConfig().entities.weather.id).toBe('sensor.weather');
    expect(getConfig().entities.weather.domain).toBe('weather');
  });
});

describe('validateConfig', () => {
  it('accepts the fixture config', () => {
    expect(validateConfig(getConfig())).toEqual([]);
  });

  it('flags every entity of a config that is all placeholders', () => {
    const issues = validateConfig({
      entities: entitiesFrom(placeholder),
    });

    expect(issues).toHaveLength(Object.keys(mockConfig.entities).length);
    expect(issues.every((i) => /placeholder/.test(i.message))).toBe(true);
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

  it('flags a placeholder entity', () => {
    const issues = validateConfig(
      withEntities({ light: { domain: 'switch', id: placeholder('light') } }),
    );

    expect(issues).toEqual([
      { key: 'light', message: 'entity ID is still a placeholder' },
    ]);
  });

  it('flags a missing entity', () => {
    const issues = validateConfig(
      withEntities({ light: { domain: 'switch', id: ' ' } }),
    );

    expect(issues).toEqual([{ key: 'light', message: 'entity ID is missing' }]);
  });

  it('flags a malformed entity ID', () => {
    const issues = validateConfig(
      withEntities({ light: { domain: 'switch', id: 'Switch Office' } }),
    );

    expect(issues[0]?.message).toMatch(/not a valid entity ID/);
  });

  it('flags an entity in the wrong domain', () => {
    const issues = validateConfig(
      withEntities({ light: { domain: 'switch', id: 'sensor.office' } }),
    );

    expect(issues[0]?.message).toMatch(/switch domain/);
  });

  it('checks the climate domain', () => {
    expect(
      validateConfig(
        withEntities({ ac: { domain: 'climate', id: 'climate.office' } }),
      ),
    ).toEqual([]);
    expect(
      validateConfig(
        withEntities({ ac: { domain: 'climate', id: 'switch.office' } }),
      )[0]?.message,
    ).toMatch(/climate domain/);
  });
});

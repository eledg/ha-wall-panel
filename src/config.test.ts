import { describe, expect, it } from 'vitest';

import { config, placeholder, validateConfig } from './config.ts';

const withEntities = (
  entities: Record<string, { domain: 'sensor' | 'switch'; id: string }>,
) => ({
  entities,
});

describe('validateConfig', () => {
  it('accepts the shipped config', () => {
    expect(validateConfig(config)).toEqual([]);
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
});

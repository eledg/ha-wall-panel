import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { build } from 'vite';
import type { ConfigEnv, UserConfig } from 'vite';
import { afterEach, describe, expect, it } from 'vitest';

import { devHaPlugin } from './dev-ha.ts';

const env = { HA_DEV_URL: 'http://ha:8123', HA_DEV_TOKEN: 'sentinel-token' };

const defineFor = (command: ConfigEnv['command'], mode: string) => {
  const hook = devHaPlugin(env).config as (
    config: UserConfig,
    env: ConfigEnv,
  ) => UserConfig;
  return hook({}, { command, mode }).define!.__HA_DEV__;
};

describe('dev-ha plugin', () => {
  it('defines the settings for the dev server only', () => {
    expect(JSON.parse(defineFor('serve', 'development'))).toEqual({
      url: 'http://ha:8123',
      token: 'sentinel-token',
    });
  });

  it('defines nothing for a build', () => {
    expect(defineFor('build', 'production')).toBe('undefined');
    expect(defineFor('build', 'development')).toBe('undefined');
  });

  it('defines nothing for tests', () => {
    expect(defineFor('serve', 'test')).toBe('undefined');
  });
});

describe('production build', () => {
  const out = mkdtempSync(join(tmpdir(), 'wall-build-'));
  afterEach(() => rmSync(out, { recursive: true, force: true }));

  it('does not contain the dev token', async () => {
    process.env.HA_DEV_TOKEN = 'sentinel-token';
    process.env.VITE_HA_TOKEN = 'sentinel-token';
    try {
      await build({
        logLevel: 'silent',
        build: { outDir: out, emptyOutDir: true },
      });
    } finally {
      delete process.env.HA_DEV_TOKEN;
      delete process.env.VITE_HA_TOKEN;
    }

    const files = readdirSync(out, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(readFileSync(file, 'utf8'), file).not.toContain('sentinel-token');
    }
  }, 30_000);
});

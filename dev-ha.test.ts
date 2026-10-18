import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { build } from 'vite';
import type { ConfigEnv, UserConfig } from 'vite';
import { afterEach, describe, expect, it } from 'vitest';

import { devHaPlugin } from './dev-ha.ts';
import { MOCK_MARKER } from './src/dev/mock/engine.ts';

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

describe('dev-ha plugin, /api proxy', () => {
  const serverFor = (
    command: ConfigEnv['command'],
    mode: string,
    settings: Record<string, string> = env,
  ) => {
    const hook = devHaPlugin(settings).config as (
      config: UserConfig,
      env: ConfigEnv,
    ) => UserConfig;
    return hook({}, { command, mode }).server;
  };

  it('proxies /api to HA for the dev server only', () => {
    expect(serverFor('serve', 'development')?.proxy).toEqual({
      '/api': { target: 'http://ha:8123', changeOrigin: true },
    });
  });

  it('adds no proxy to builds, preview, tests or the mock', () => {
    expect(serverFor('build', 'production')?.proxy).toBeUndefined();
    expect(serverFor('build', 'development')?.proxy).toBeUndefined();
    // `vite preview` is a serve in production mode, and reuses server.proxy.
    expect(serverFor('serve', 'production')?.proxy).toBeUndefined();
    expect(serverFor('serve', 'test')?.proxy).toBeUndefined();
    expect(serverFor('serve', 'mock')?.proxy).toBeUndefined();
  });

  it('adds none when no HA URL is set', () => {
    expect(serverFor('serve', 'development', {})?.proxy).toBeUndefined();
  });
});

describe('dev-ha plugin, mock switch', () => {
  const mockFor = (command: ConfigEnv['command'], mode: string) => {
    const hook = devHaPlugin(env).config as (
      config: UserConfig,
      env: ConfigEnv,
    ) => UserConfig;
    return hook({}, { command, mode }).define!.__HA_MOCK__;
  };

  it('is on only for the dev server in mock mode', () => {
    expect(mockFor('serve', 'mock')).toBe('true');
    expect(mockFor('serve', 'development')).toBe('false');
    expect(mockFor('serve', 'test')).toBe('false');
    expect(mockFor('build', 'production')).toBe('false');
    expect(mockFor('build', 'mock')).toBe('false');
  });
});

describe('production build', () => {
  // Also covers `vite build --mode mock`: the mock is dev-server only.
  const out = mkdtempSync(join(tmpdir(), 'wall-build-'));
  afterEach(() => rmSync(out, { recursive: true, force: true }));

  it('does not contain the dev token', async () => {
    // Vitest sets NODE_ENV=test, which would build the larger development bundle.
    const nodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.HA_DEV_TOKEN = 'sentinel-token';
    process.env.VITE_HA_TOKEN = 'sentinel-token';
    try {
      await build({
        logLevel: 'silent',
        build: { outDir: out, emptyOutDir: true },
      });
    } finally {
      process.env.NODE_ENV = nodeEnv;
      delete process.env.HA_DEV_TOKEN;
      delete process.env.VITE_HA_TOKEN;
    }

    const files = readdirSync(out, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toContain('sentinel-token');
      expect(text, file).not.toContain('changeOrigin');
      expect(text, file).not.toContain(MOCK_MARKER);
      // Mock-only data and UI: weather scenarios and the dev dock.
      expect(text, file).not.toContain('banana');
      expect(text, file).not.toContain('Forecast fetch');
      expect(text, file).not.toContain('HA flips light');
      expect(text, file).not.toContain('mock-overlay');
    }
  }, 30_000);
});

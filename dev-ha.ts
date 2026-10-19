import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { Plugin } from 'vite';

import { configUrl } from './src/config/url.ts';

// Hands the dev server's HA settings to the app as __HA_DEV__. The token is
// named HA_DEV_TOKEN, without Vite's VITE_ prefix, so Vite never exposes it to
// client code by itself, and it is defined here only for `vite` (the dev
// server). Builds and tests get undefined, so a build cannot contain it.
// __HA_MOCK__ follows the same rule, so the mock can't reach a build either.
export const devHaPlugin = (
  env: Record<string, string>,
  base = '/',
): Plugin => ({
  name: 'dev-ha',
  // Serves your local config.json (HA_DEV_CONFIG, default ./config.json, git-ignored)
  // where the app looks for it on HA, so `pnpm dev` loads it like a deploy would.
  configureServer: (server) => {
    if (server.config.mode !== 'development') return;
    const file = resolve(env.HA_DEV_CONFIG || 'config.json');
    server.middlewares.use(configUrl(base), (_req, res) => {
      readFile(file, 'utf8').then(
        (text) => {
          res.setHeader('content-type', 'application/json');
          res.end(text);
        },
        () => {
          res.statusCode = 404;
          res.end();
        },
      );
    });
  },
  config: (_, { command, mode }) => {
    const dev = command === 'serve' && mode === 'development';
    return {
      define: {
        __HA_DEV__: dev
          ? JSON.stringify({ url: env.HA_DEV_URL, token: env.HA_DEV_TOKEN })
          : 'undefined',
        // `vite --mode mock` runs the app against the fake HA in src/dev/mock/.
        __HA_MOCK__: String(command === 'serve' && mode === 'mock'),
      },
      // The websocket reaches HA directly, but HA's REST API (the calendar)
      // refuses the dev origin (CORS), so `/api` goes through the dev server.
      // Same gate as the token: `vite preview` (which reuses `server.proxy`),
      // builds, tests and the mock get no proxy.
      server:
        dev && env.HA_DEV_URL
          ? {
              proxy: { '/api': { target: env.HA_DEV_URL, changeOrigin: true } },
            }
          : {},
    };
  },
});

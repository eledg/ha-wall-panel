import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { Connect, Plugin } from 'vite';

import { configUrl } from './src/config/url.ts';
import { FAILING_TOKEN } from './src/dev/mock/scenarios/door.ts';

// The mock's camera, as HA serves it: a snapshot, and a multipart "MJPEG" stream
// that sends the same frame every 200 ms. The token FAILING_TOKEN makes the stream fail.
const mockCamera = (middlewares: Connect.Server) => {
  const jpeg = readFileSync(
    new URL('./src/dev/mock/scenarios/door-frame.jpg', import.meta.url),
  );
  // Mounted on /api: connect only matches a prefix up to a slash, and the
  // stream's path is /api/camera_proxy_stream.
  middlewares.use('/api', (req, res, next) => {
    const url = new URL(req.originalUrl ?? '', 'http://localhost');
    if (!url.pathname.startsWith('/api/camera_proxy')) return next();
    if (!url.pathname.startsWith('/api/camera_proxy_stream')) {
      res.setHeader('content-type', 'image/jpeg');
      res.end(jpeg);
      return;
    }
    if (url.searchParams.get('token') === FAILING_TOKEN) {
      res.statusCode = 500;
      res.end();
      return;
    }
    res.setHeader('content-type', 'multipart/x-mixed-replace; boundary=frame');
    const send = () => {
      const body = jpeg;
      res.write(
        `--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${body.length}\r\n\r\n`,
      );
      res.write(body);
      res.write('\r\n');
    };
    send();
    const timer = setInterval(send, 200);
    req.on('close', () => clearInterval(timer));
  });
};

// Hands the dev server's HA settings to the app as __HA_DEV__. The token is
// named HA_DEV_TOKEN, without Vite's VITE_ prefix, so Vite never exposes it to
// client code by itself, and it is defined here only for `vite` (the dev
// server). Builds and tests get undefined, so a build cannot contain it.
// __HA_MOCK__ follows the same rule, so the mock can't reach a build either.
export const devHaPlugin = (env: Record<string, string>): Plugin => ({
  name: 'dev-ha',
  // Serves your local config.json (HA_DEV_CONFIG, default ./config.json, git-ignored)
  // where the app looks for it from the dev server's root, so `pnpm dev` loads it
  // like a deploy would.
  configureServer: (server) => {
    if (server.config.mode === 'mock') mockCamera(server.middlewares);
    if (server.config.mode !== 'development') return;
    const file = resolve(env.HA_DEV_CONFIG || 'config.json');
    server.middlewares.use(configUrl('/'), (_req, res) => {
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

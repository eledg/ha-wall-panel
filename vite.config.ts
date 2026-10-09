import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

import { buildInfoPlugin, resolveBuildInfo } from './build-info.ts';
import { devHaPlugin } from './dev-ha.ts';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Folder under HA's /config/www/ that this build is served from.
  // Override with WALL_BASE_PATH to target another display.
  const base = env.WALL_BASE_PATH || '/local/office-wall-display/';

  return {
    base,
    plugins: [
      tailwindcss(),
      preact(),
      buildInfoPlugin(resolveBuildInfo(env)),
      devHaPlugin(env),
    ],
    build: {
      target: 'es2023',
    },
  };
});

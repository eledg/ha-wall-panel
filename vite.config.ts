import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import { configDefaults, defineConfig } from 'vitest/config';

import { buildInfoPlugin, resolveBuildInfo } from './build-info.ts';
import { bundleBudgetPlugin } from './bundle-budget.ts';
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
      bundleBudgetPlugin(),
      devHaPlugin(env),
    ],
    // Fail rather than drift to another port, so `pnpm dev` is never mistaken
    // for a `pnpm dev:mock` server still running on the usual one.
    server: { strictPort: true },
    build: {
      target: 'es2023',
    },
    test: {
      // The git-ignored design prototype has its own tests and deps; e2e/ is Playwright's.
      exclude: [...configDefaults.exclude, '.lovable-design/**', 'e2e/**'],
    },
  };
});

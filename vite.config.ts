import { fileURLToPath } from 'node:url';

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

  return {
    // Relative asset URLs, so one build works from any folder under HA's
    // /config/www/ (the page URL must end in index.html or a slash).
    base: './',
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
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
      setupFiles: ['src/tests/setup.ts'],
      // The git-ignored design prototype has its own tests and deps; e2e/ is Playwright's.
      exclude: [...configDefaults.exclude, '.lovable-design/**', 'e2e/**'],
    },
  };
});

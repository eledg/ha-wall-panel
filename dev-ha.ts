import type { Plugin } from 'vite';

// Hands the dev server's HA settings to the app as __HA_DEV__. The token is
// named HA_DEV_TOKEN, without Vite's VITE_ prefix, so Vite never exposes it to
// client code by itself, and it is defined here only for `vite` (the dev
// server). Builds and tests get undefined, so a build cannot contain it.
// __HA_MOCK__ follows the same rule, so the mock can't reach a build either.
export const devHaPlugin = (env: Record<string, string>): Plugin => ({
  name: 'dev-ha',
  config: (_, { command, mode }) => ({
    define: {
      __HA_DEV__:
        command === 'serve' && mode === 'development'
          ? JSON.stringify({ url: env.HA_DEV_URL, token: env.HA_DEV_TOKEN })
          : 'undefined',
      // `vite --mode mock` runs the app against the fake HA in src/ha/mock.ts.
      __HA_MOCK__: String(command === 'serve' && mode === 'mock'),
    },
  }),
});

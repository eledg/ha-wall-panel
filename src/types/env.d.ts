// Injected at build time by the build-info plugin (see build-info.ts).
declare const __BUILD_INFO__: {
  version: string;
  commit: string;
  builtAt: string;
};
// Injected by the dev-ha plugin (see dev-ha.ts): the HA settings from
// .env.local while the dev server runs, and undefined in every build and test.
declare const __HA_DEV__: { url?: string; token?: string } | undefined;
// True only for `vite --mode mock` (pnpm dev:mock): the app runs against the
// in-page fake HA in src/dev/mock/. False in builds and tests.
declare const __HA_MOCK__: boolean;

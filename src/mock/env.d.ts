// True only for `vite --mode mock` (pnpm dev:mock): the app runs against the
// in-page fake HA in src/mock/. False in builds and tests.
declare const __HA_MOCK__: boolean;

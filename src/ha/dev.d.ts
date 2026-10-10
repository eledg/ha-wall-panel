// Injected by the dev-ha plugin (see dev-ha.ts): the HA settings from
// .env.local while the dev server runs, and undefined in every build and test.
declare const __HA_DEV__: { url?: string; token?: string } | undefined;

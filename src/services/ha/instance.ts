import { createHaStore } from './store.ts';

// __HA_MOCK__ is true only under `pnpm dev:mock` (see dev-ha.ts). In every
// other build it is the literal `false`, so this branch and the whole of
// src/dev/mock/ are dropped from the bundle. This is the app's only seam to the mock.
// eslint-disable-next-line import-x/no-restricted-paths -- the one gated seam to dev/
const mock = __HA_MOCK__ ? await import('@/dev/mock/index.tsx') : undefined;
mock?.mountOverlay();

export const haAuth = mock?.getAuth;
export const haStore = createHaStore(mock?.deps);

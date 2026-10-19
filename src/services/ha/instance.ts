import { applyConfig } from '@/config/config.ts';
import { loadConfig } from '@/config/load.ts';

import { createHaStore } from './store.ts';

// __HA_MOCK__ is true only under `pnpm dev:mock` (see dev-ha.ts). In every
// other build it is the literal `false`, so these branches and the whole of
// src/dev/mock/ are dropped from the bundle. This is the app's only seam to the mock.
// The config comes first: the mock reads entity IDs from it when it loads.
if (__HA_MOCK__) {
  // eslint-disable-next-line import-x/no-restricted-paths -- the gated seam to dev/
  applyConfig((await import('@/dev/mock/config.ts')).mockConfig);
} else {
  await loadConfig();
}
// eslint-disable-next-line import-x/no-restricted-paths -- the one gated seam to dev/
const mock = __HA_MOCK__ ? await import('@/dev/mock/index.tsx') : undefined;
mock?.mountOverlay();

export const haAuth = mock?.getAuth;
export const haStore = createHaStore(mock?.deps);

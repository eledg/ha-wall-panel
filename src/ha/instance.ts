import { createMockHa } from './mock.ts';
import { createHaStore } from './store.ts';

// __HA_MOCK__ is true only under `pnpm dev:mock` (see dev-ha.ts). In every
// other build it is the literal `false`, so the mock is dropped from the bundle.
export const mockHa = __HA_MOCK__ ? createMockHa() : undefined;

export const haStore = createHaStore(mockHa?.deps);

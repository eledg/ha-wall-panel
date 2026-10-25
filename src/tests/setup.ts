import { afterEach, beforeEach, vi } from 'vitest';

import { applyConfig } from '@/config/config.ts';
import type * as Load from '@/config/load.ts';
import { mockConfig } from '@/dev/mock/config.ts';
import { captureConsole, releaseConsole } from '@/tests/console.ts';

// Tests run against the fixture config, as the mock does. `instance.ts` would
// otherwise fetch a `config.json` that does not exist here and replace it.
vi.mock('@/config/load.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof Load>()),
  loadConfig: async () => {},
}));

applyConfig(mockConfig);

// Tests stay quiet: console errors and warnings fail the test unless it
// declares them with `expectConsole()`.
beforeEach(captureConsole);
afterEach(releaseConsole);

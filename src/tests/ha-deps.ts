import { vi } from 'vitest';

import type { HaDeps } from '@/services/ha/store.ts';

/**
 * Fake Home Assistant connection for a store under test. `push` delivers an
 * entities update to the store's subscription, once it has started.
 */
export const fakeHaDeps = () => {
  let push: (all: unknown) => void = () => {};
  const deps = {
    createConnection: vi
      .fn()
      .mockResolvedValue({ addEventListener: vi.fn(), close: vi.fn() }),
    subscribeEntities: vi.fn((_, cb) => {
      push = cb;
      return vi.fn();
    }),
    callService: vi.fn().mockResolvedValue({ response: {} }),
    fetchCalendarEvents: vi.fn().mockResolvedValue([]),
  };
  return { deps: deps as unknown as HaDeps, push: (all: unknown) => push(all) };
};

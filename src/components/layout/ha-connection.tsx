import type { ComponentChildren } from 'preact';

import { OfflineContext } from '@/hooks/use-offline.ts';
import { useSnapshot } from '@/hooks/use-snapshot.ts';
import { haStore } from '@/services/ha/instance.ts';
import type { HaStore } from '@/services/ha/store.ts';

/**
 * Tells every `Tile` below it whether HA is unreachable, so tiles go stale and
 * stop taking taps without each one handling it. Wrap the tiles once, at the root.
 */
export const HaConnection = ({
  store = haStore,
  children,
}: {
  store?: HaStore;
  children?: ComponentChildren;
}) => (
  <OfflineContext.Provider
    value={useSnapshot(store, (s) => s.status !== 'connected')}
  >
    {children}
  </OfflineContext.Provider>
);

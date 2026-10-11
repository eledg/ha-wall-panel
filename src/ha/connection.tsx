import { createContext } from 'preact';
import type { ComponentChildren } from 'preact';
import { useContext } from 'preact/hooks';

import { haStore } from './instance.ts';
import type { HaStore } from './store.ts';
import { useSnapshot } from './use-snapshot.ts';

const OfflineContext = createContext(false);

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

/** True while HA is not connected. False outside an `HaConnection`. */
export const useOffline = () => useContext(OfflineContext);

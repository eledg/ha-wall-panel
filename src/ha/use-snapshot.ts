import { useEffect, useState } from 'preact/hooks';

import type { HaStore } from './store.ts';

/** Re-renders the component whenever the store's snapshot changes. */
export const useSnapshot = (store: HaStore) => {
  const [snapshot, setSnapshot] = useState(store.getSnapshot);
  useEffect(() => {
    const sync = () => setSnapshot(store.getSnapshot());
    sync();
    return store.subscribe(sync);
  }, [store]);
  return snapshot;
};

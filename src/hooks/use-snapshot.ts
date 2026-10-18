import { useEffect, useRef, useState } from 'preact/hooks';

import type { HaSnapshot, HaStore } from '@/services/ha/store.ts';

/** Equal when both arrays hold the same items, compared with `Object.is`. */
export const shallowEqual = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((item, i) => Object.is(item, b[i]));

/**
 * Re-renders the component when the part of the snapshot it selects changes,
 * so a tile does not redraw for another tile's update. Without a selector it
 * follows the whole snapshot.
 *
 * The selector returns a value compared with `Object.is`, or, for several
 * values, an array compared item by item. It may be an inline function.
 */
type UseSnapshot = {
  (store: HaStore): HaSnapshot;
  <T>(store: HaStore, select: (snapshot: HaSnapshot) => T): T;
};

export const useSnapshot: UseSnapshot = (
  store: HaStore,
  select: (snapshot: HaSnapshot) => unknown = (snapshot) => snapshot,
) => {
  // Always the latest selector, without resubscribing on every render.
  const selectRef = useRef(select);
  useEffect(() => {
    selectRef.current = select;
  });
  const [selected, setSelected] = useState(() => select(store.getSnapshot()));
  useEffect(() => {
    const sync = () => {
      const next = selectRef.current(store.getSnapshot());
      // Returning the previous value makes the state setter skip the render.
      setSelected((prev: unknown) =>
        Array.isArray(prev) && Array.isArray(next) && shallowEqual(prev, next)
          ? prev
          : next,
      );
    };
    sync();
    return store.subscribe(sync);
  }, [store]);
  return selected as never;
};

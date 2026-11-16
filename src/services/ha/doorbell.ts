import { type Config, getConfig } from '@/config/config.ts';

import { createRingDetector } from './ring.ts';
import type { HaStore } from './store.ts';

/**
 * What happened at a door tile: a `ring` from the doorbell, or an `open` from
 * a tap on the tile. Either one brings up that door's camera.
 */
export type DoorEvent = { kind: 'ring' | 'open'; tileId: string; at: number };

export type Doorbell = ReturnType<typeof createDoorbell>;

/**
 * The app-level doorbell: watches the ring entity of every door tile and
 * raises one `ring` per press, whichever screen is showing. Listeners also
 * hear the tiles' taps, so the overlay has one place to listen.
 */
export const createDoorbell = (
  store: HaStore,
  cfg: Config = getConfig(),
  detect = createRingDetector(),
  now = Date.now,
) => {
  const listeners = new Set<(event: DoorEvent) => void>();
  const emit = (event: DoorEvent) =>
    listeners.forEach((listener) => listener(event));
  const doors = cfg.tiles.flatMap((tile) =>
    tile.type === 'door' ? [{ tileId: tile.id, ring: tile.entities.ring }] : [],
  );

  const check = () => {
    const { entities } = store.getSnapshot();
    for (const { tileId, ring } of doors) {
      if (detect(ring, entities[ring]))
        emit({ kind: 'ring', tileId, at: now() });
    }
  };
  check();
  const unsubscribe = doors.length > 0 ? store.subscribe(check) : () => {};

  return {
    /** Calls `listener` for every ring and tap; returns the unsubscribe. */
    subscribe: (listener: (event: DoorEvent) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** A tap on a door tile: show its camera without a ring. */
    open: (tileId: string) => emit({ kind: 'open', tileId, at: now() }),
    stop: unsubscribe,
  };
};

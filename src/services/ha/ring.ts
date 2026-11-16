import type { HassEntity } from 'home-assistant-js-websocket';

import { RING_DEBOUNCE_MS, RING_MAX_AGE_MS } from '@/config/constants.ts';

/**
 * Tells new doorbell rings from everything else HA sends for a ring `event`
 * entity, whose state is the time of the last ring (see `docs/doorbell.md`).
 * Call it with each entity's latest state; it returns true once per ring.
 *
 * Not a ring: the first state seen (the last ring, perhaps hours old), the same
 * state re-sent on reconnect, `unknown` or `unavailable`, another event type, a
 * ring further than `maxAgeMs` from now (an old one replayed), and a second
 * event within `debounceMs` (one press fires twice). A change from `unknown` or
 * `unavailable` does count when it is fresh: that is the first ring after HA restarts.
 */
export const createRingDetector = ({
  debounceMs = RING_DEBOUNCE_MS,
  maxAgeMs = RING_MAX_AGE_MS,
  now = Date.now,
}: { debounceMs?: number; maxAgeMs?: number; now?: () => number } = {}) => {
  const lastState = new Map<string, string>();
  const lastRing = new Map<string, number>();

  return (id: string, entity: HassEntity | undefined) => {
    if (!entity) {
      // Gone, or the store restarted: its next state is a first one again.
      lastState.delete(id);
      return false;
    }
    const previous = lastState.get(id);
    lastState.set(id, entity.state);
    if (previous === undefined || previous === entity.state) return false;
    if (entity.attributes.event_type !== 'ring') return false;
    const at = Date.parse(entity.state);
    if (Number.isNaN(at)) return false;
    const time = now();
    if (Math.abs(time - at) > maxAgeMs) return false;
    const last = lastRing.get(id);
    if (last !== undefined && time - last < debounceMs) return false;
    lastRing.set(id, time);
    return true;
  };
};

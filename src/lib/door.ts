import type { HassEntity } from 'home-assistant-js-websocket';

import { RING_MAX_AGE_MS } from '@/config/constants.ts';

/**
 * When the doorbell last rang (epoch ms), if that was within `windowMs` of
 * `now` and after `dismissedAt`, the last ring someone dismissed. The ring entity's state is the time of its last ring, or `unknown`
 * or `unavailable`. A time a little ahead of `now` (clock skew) still counts.
 */
export const recentRing = (
  ring: HassEntity | undefined,
  now: number,
  windowMs: number,
  dismissedAt?: number,
) => {
  const at = ring ? Date.parse(ring.state) : Number.NaN;
  if (Number.isNaN(at) || (dismissedAt !== undefined && at <= dismissedAt))
    return undefined;
  const age = now - at;
  return age >= -RING_MAX_AGE_MS && age < windowMs ? at : undefined;
};

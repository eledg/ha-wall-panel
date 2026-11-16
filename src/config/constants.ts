/** Close the modal after this long without a touch, so it never hides the tiles. */
export const IDLE_CLOSE_MS = 30_000;

/** How long a control flashes after a failed call (the design's 900 ms). */
export const FLASH_MS = 900;

/** Doorbell presses closer together than this count as one ring: one press fires twice. */
export const RING_DEBOUNCE_MS = 5_000;

/**
 * A ring whose time is further than this from now is not new: HA re-sends the
 * last ring on every reconnect, and it may be hours old.
 */
export const RING_MAX_AGE_MS = 10_000;

/** The door tile shows "Rang HH:MM" for this long after a ring. */
export const RECENT_RING_MS = 30 * 60_000;

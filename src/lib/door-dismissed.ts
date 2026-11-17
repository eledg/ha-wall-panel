const KEY = 'ha-wall-panel:door-dismissed:';

export type DoorDismissals = ReturnType<typeof createDoorDismissals>;

/**
 * The time of the last ring dismissed on each door tile (epoch ms), kept in
 * `localStorage` so a reload does not bring it back. Storage that fails is
 * treated as empty: the ring shows again after a reload, but a dismissal
 * still holds until then.
 */
export const createDoorDismissals = (
  storage: () => Storage = () => localStorage,
) => {
  const session = new Map<string, number>();
  const listeners = new Set<() => void>();

  return {
    /** When the last dismissed ring happened, or `undefined`. */
    get: (tileId: string) => {
      let stored = 0;
      try {
        stored = Number(storage().getItem(KEY + tileId)) || 0;
      } catch {
        // Fall back to this session's dismissals.
      }
      return Math.max(stored, session.get(tileId) ?? 0) || undefined;
    },
    /** Hides the ring at `at`, and any earlier one. */
    dismiss: (tileId: string, at: number) => {
      session.set(tileId, at);
      try {
        storage().setItem(KEY + tileId, String(at));
      } catch {
        // Kept in memory only.
      }
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
};

/** The panel's own: shared by the door tiles and the doorbell overlay. */
export const doorDismissals = createDoorDismissals();

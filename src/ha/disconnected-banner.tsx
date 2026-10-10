import { haStore } from './instance.ts';
import type { HaStore } from './store.ts';
import { useSnapshot } from './use-snapshot.ts';
import { formatTime } from '../format.ts';

/**
 * A pill at the top while HA is unreachable, with when data last arrived. Hidden
 * while first connecting, so it never flashes at boot. Display only (no taps),
 * so it can sit in the edge zone.
 */
export const DisconnectedBanner = ({
  store = haStore,
}: {
  store?: HaStore;
}) => {
  const { status, lastUpdate } = useSnapshot(store);
  if (status !== 'disconnected' && status !== 'error') return null;
  return (
    <div
      role="status"
      class="pointer-events-none fixed top-1.5 left-1/2 z-30 -translate-x-1/2 rounded-full border border-warn/40 bg-warn-soft px-3 py-0.5 text-small text-warn"
    >
      Reconnecting…
      {lastUpdate !== undefined && (
        <span class="tnum text-fg-dim">
          {' '}
          last updated {formatTime(lastUpdate)}
        </span>
      )}
    </div>
  );
};

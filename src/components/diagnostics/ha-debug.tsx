import { entityRefs } from '@/config/config.ts';
import { RING_UNAVAILABLE_MS } from '@/config/constants.ts';
import { useSnapshot } from '@/hooks/use-snapshot.ts';
import { haStore } from '@/services/ha/instance.ts';
import type { HaStore } from '@/services/ha/store.ts';

/** HA calendars are `on` only while an event is happening, so say that. */
const CALENDAR_STATE: Record<string, string> = {
  on: 'Event in progress',
  off: 'No event now',
};

/** Live state for each configured entity, plus what the store subscribes to. */
export const HaDebug = ({
  store = haStore,
  now = Date.now,
}: {
  store?: HaStore;
  now?: () => number;
}) => {
  const { status, error, entities } = useSnapshot(store);
  // Each entity once, alphabetical by the ID shown, not by config order.
  const domains = new Map(entityRefs().map(({ id, domain }) => [id, domain]));
  const rings = new Set(
    entityRefs()
      .filter(({ path }) => path.endsWith('.ring'))
      .map(({ id }) => id),
  );
  const ids = [...domains.keys()].sort((a, b) => a.localeCompare(b));

  return (
    <section class="pt-5">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h3 class="text-lg font-semibold text-fg">Subscribed entities</h3>
        <span class="tnum text-sm text-fg-dim">{ids.length} entities</span>
      </div>
      {error && <p class="font-mono text-small text-warn">{error}</p>}
      <dl class="divide-y divide-line">
        {ids.map((id) => {
          const entity = entities[id];
          const unit = entity?.attributes.unit_of_measurement;
          const raw = entity?.state;
          const state =
            domains.get(id) === 'calendar' && raw
              ? (CALENDAR_STATE[raw] ?? raw)
              : (raw ?? 'no state');
          const suffix = entity && unit ? ` ${unit}` : '';
          const value =
            status === 'connected' ? `${state}${suffix}` : 'Unavailable';
          // A doorbell that stays unavailable cannot ring, so say for how long.
          const since = Date.parse(entity?.last_changed ?? '');
          const down =
            status === 'connected' &&
            rings.has(id) &&
            raw === 'unavailable' &&
            now() - since > RING_UNAVAILABLE_MS;
          return (
            <div
              key={id}
              class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4"
            >
              <dt class="min-w-0 break-all font-mono text-sm text-fg-dim">
                {id}
              </dt>
              <dd
                class={`tnum text-sm font-medium ${down ? 'text-warn' : 'text-fg'}`}
              >
                {down
                  ? `Unavailable for ${Math.round((now() - since) / 60_000)} min`
                  : value}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
};

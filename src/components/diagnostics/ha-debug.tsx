import { getConfig } from '@/config/config.ts';
import { useSnapshot } from '@/hooks/use-snapshot.ts';
import { haStore } from '@/services/ha/instance.ts';
import type { EntityKey, HaStore } from '@/services/ha/store.ts';

/** HA calendars are `on` only while an event is happening, so say that. */
const CALENDAR_STATE: Record<string, string> = {
  on: 'Event in progress',
  off: 'No event now',
};

/** Live state for each configured entity, plus what the store subscribes to. */
export const HaDebug = ({ store = haStore }: { store?: HaStore }) => {
  const { status, error, entities } = useSnapshot(store);
  const configured = getConfig().entities;
  // Alphabetical by the entity ID shown, not by config order.
  const keys = (Object.keys(configured) as EntityKey[]).sort((a, b) =>
    configured[a].id.localeCompare(configured[b].id),
  );

  return (
    <section class="pt-5">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h3 class="text-lg font-semibold text-fg">Subscribed entities</h3>
        <span class="tnum text-sm text-fg-dim">{keys.length} entities</span>
      </div>
      {error && <p class="font-mono text-small text-warn">{error}</p>}
      <dl class="divide-y divide-line">
        {keys.map((key) => {
          const entity = entities[key];
          const unit = entity?.attributes.unit_of_measurement;
          const raw = entity?.state;
          const state =
            configured[key].domain === 'calendar' && raw
              ? (CALENDAR_STATE[raw] ?? raw)
              : (raw ?? 'no state');
          const suffix = entity && unit ? ` ${unit}` : '';
          const value =
            status === 'connected' ? `${state}${suffix}` : 'Unavailable';
          return (
            <div
              key={key}
              class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4"
            >
              <dt class="min-w-0 break-all font-mono text-sm text-fg-dim">
                {configured[key].id}
              </dt>
              <dd class="tnum text-sm font-medium text-fg">{value}</dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
};

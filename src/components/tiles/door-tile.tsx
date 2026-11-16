import { CameraIcon } from '@/components/icons/camera-icon.tsx';
import { DoorIcon } from '@/components/icons/door-icon.tsx';
import type { TileConfig } from '@/config/config.ts';
import { useMinute } from '@/hooks/use-minute.ts';
import { useSnapshot } from '@/hooks/use-snapshot.ts';
import { recentRing } from '@/lib/door.ts';
import { formatTime } from '@/lib/format.ts';
import type { Doorbell } from '@/services/ha/doorbell.ts';
import { isUsable } from '@/services/ha/entity.ts';
import { doorbell as appDoorbell, haStore } from '@/services/ha/instance.ts';
import type { HaStore } from '@/services/ha/store.ts';

import { DeviceTile } from './base/device-tile.tsx';
import { tileState } from './base/tile.tsx';

/**
 * A doorbell: "Rang 09:41" in the accent colour for half an hour after a
 * ring, otherwise a camera badge. A tap shows the door's camera without a ring.
 */
export const DoorTile = ({
  tile,
  store = haStore,
  doorbell = appDoorbell,
}: {
  tile: TileConfig<'door'>;
  store?: HaStore;
  doorbell?: Doorbell;
}) => {
  const ring = useSnapshot(store, (s) => s.entities[tile.entities.ring]);
  const camera = useSnapshot(store, (s) => s.entities[tile.entities.camera]);
  const now = useMinute();
  // `unknown` is a doorbell that hasn't rung since HA restarted: still usable.
  const usable = isUsable(camera) && ring?.state !== 'unavailable';
  const state = tileState([ring, camera], usable);
  const rangAt = recentRing(ring, now.getTime());

  return (
    <DeviceTile
      place={tile}
      state={state}
      onTap={state === undefined ? () => doorbell.open(tile.id) : undefined}
      centerValue
      tone={rangAt === undefined ? 'neutral' : 'accent'}
      icon={<DoorIcon class="mt-0.5 size-4 shrink-0" />}
      label={tile.label}
      value={
        rangAt === undefined ? (
          <div class="grid size-12 place-items-center rounded-full bg-surface-2 text-fg-dim">
            <CameraIcon class="size-6" />
          </div>
        ) : (
          <div class="tnum text-center text-xl font-semibold leading-tight">
            Rang{' '}
            <time class="block" dateTime={new Date(rangAt).toISOString()}>
              {formatTime(rangAt)}
            </time>
          </div>
        )
      }
    />
  );
};

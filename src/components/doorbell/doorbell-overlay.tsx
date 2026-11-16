import { useEffect, useState } from 'preact/hooks';

import { type Config, getConfig } from '@/config/config.ts';
import { useNightHold } from '@/hooks/night-hold.ts';
import { recentRing } from '@/lib/door.ts';
import { formatTime } from '@/lib/format.ts';
import type { Doorbell, DoorEvent } from '@/services/ha/doorbell.ts';
import { doorbell as appDoorbell, haStore } from '@/services/ha/instance.ts';
import type { HaStore } from '@/services/ha/store.ts';

type Shown = {
  /** Bumped by every event, so a new ring restarts the countdown. */
  session: number;
  label: string;
  src?: string;
  ringAt?: number;
  timeoutSeconds: number;
};

/**
 * The snapshot URL. The access token rotates about every 5 minutes, so it is
 * read when the overlay opens, not kept. Without one (the mock's placeholder
 * has none) the entity's own `entity_picture` is used.
 */
const snapshotUrl = (
  camera: string,
  attributes: Record<string, unknown> | undefined,
) => {
  const token = attributes?.access_token;
  if (typeof token === 'string' && token !== '')
    return `/api/camera_proxy/${camera}?token=${encodeURIComponent(token)}`;
  const picture = attributes?.entity_picture;
  return typeof picture === 'string' ? picture : undefined;
};

/**
 * The doorbell's camera over everything, on a ring or a tap on the door tile:
 * a still snapshot (uncropped, portrait 3:4), when it rang, a countdown to
 * closing and a large Dismiss. While open it holds the night dimming off and
 * blocks auto-reload. A ring while open restarts the countdown, not a second
 * overlay. The picture is not greyed: the camera sends greyscale frames itself
 * when it switches to infrared (docs/doorbell.md).
 */
export const DoorbellOverlay = ({
  store = haStore,
  doorbell = appDoorbell,
  cfg = getConfig(),
  now = Date.now,
}: {
  store?: HaStore;
  doorbell?: Doorbell;
  cfg?: Config;
  now?: () => number;
}) => {
  const [shown, setShown] = useState<Shown | undefined>();
  const [left, setLeft] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(
    () =>
      doorbell.subscribe((event: DoorEvent) => {
        const tile = cfg.tiles.find(
          (t) => t.type === 'door' && t.id === event.tileId,
        );
        if (tile?.type !== 'door') return;
        const { entities } = store.getSnapshot();
        const { camera, ring } = tile.entities;
        const ringed = recentRing(entities[ring], now());
        setFailed(false);
        setShown((prev) => ({
          session: (prev?.session ?? 0) + 1,
          label: tile.label,
          src: snapshotUrl(camera, entities[camera]?.attributes),
          ringAt: ringed ?? (event.kind === 'ring' ? event.at : undefined),
          timeoutSeconds: tile.timeoutSeconds,
        }));
      }),
    [doorbell, store, cfg, now],
  );

  const close = () => setShown(undefined);
  useNightHold(shown !== undefined);

  const session = shown?.session;
  const timeoutSeconds = shown?.timeoutSeconds ?? 0;
  useEffect(() => {
    if (session === undefined) return;
    setLeft(timeoutSeconds);
    let remaining = timeoutSeconds;
    const timer = setInterval(() => {
      remaining -= 1;
      setLeft(remaining);
      if (remaining <= 0) setShown(undefined);
    }, 1000);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => {
      clearInterval(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [session, timeoutSeconds]);

  if (!shown) return null;
  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby="doorbell-title"
      data-blocks-reload
      class="fixed inset-0 m-0 flex size-full max-h-none max-w-none flex-col gap-4 overflow-y-auto border-0 bg-bg p-4 text-fg z-50 min-[600px]:flex-row"
    >
      <button
        type="button"
        aria-label="Close doorbell"
        onClick={close}
        class="relative mx-auto aspect-[3/4] w-full max-w-[360px] shrink-0 block overflow-hidden rounded-tile border border-line bg-surface min-[600px]:mx-0 min-[600px]:h-full min-[600px]:w-auto min-[600px]:max-w-none"
      >
        {shown.src && !failed ? (
          <img
            src={shown.src}
            alt={`${shown.label} camera`}
            class="size-full object-contain"
            onError={() => setFailed(true)}
          />
        ) : (
          <span class="grid size-full place-items-center text-fg-dim">
            Camera unavailable
          </span>
        )}
      </button>
      <div class="flex min-w-0 flex-1 flex-col justify-between gap-4">
        <div>
          <h2 id="doorbell-title" class="text-3xl font-semibold">
            Doorbell
          </h2>
          <div class="mt-1 text-xl text-fg-dim">{shown.label}</div>
          <div class="tnum mt-3 text-2xl">
            {shown.ringAt === undefined
              ? 'Live view'
              : `Rang at ${formatTime(new Date(shown.ringAt))}`}
          </div>
        </div>
        <div>
          <div class="tnum mb-2 text-sm text-fg-dim">Auto-close {left}s</div>
          <div class="mb-4 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              class="h-full bg-fg-dim transition-[width] duration-1000 ease-linear"
              style={{ width: `${(left / shown.timeoutSeconds) * 100}%` }}
            />
          </div>
          <button
            type="button"
            class="tap h-24 w-full rounded-2xl bg-surface-2 text-2xl font-semibold text-fg"
            onClick={close}
          >
            Dismiss
          </button>
        </div>
      </div>
    </dialog>
  );
};

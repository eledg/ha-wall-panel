import { useEffect, useState } from 'preact/hooks';

import { type Config, getConfig } from '@/config/config.ts';
import {
  doorDismissals as appDismissals,
  type DoorDismissals,
} from '@/lib/door-dismissed.ts';
import { recentRing } from '@/lib/door.ts';
import { formatTime } from '@/lib/format.ts';
import type { Doorbell, DoorEvent } from '@/services/ha/doorbell.ts';
import { doorbell as appDoorbell, haStore } from '@/services/ha/instance.ts';
import type { HaStore } from '@/services/ha/store.ts';

import { CameraFeed, type FeedUrls, feedUrls } from './camera-feed.tsx';

/** The camera entity ID of a door tile. */
const cameraOf = (cfg: Config, tileId: string) => {
  const tile = cfg.tiles.find((t) => t.type === 'door' && t.id === tileId);
  return tile?.type === 'door' ? tile.entities.camera : undefined;
};

/** No URLs for a camera that is missing or unavailable, whatever stale attributes it keeps. */
const cameraUrls = (
  camera: string | undefined,
  entity: { state: string; attributes: Record<string, unknown> } | undefined,
): FeedUrls =>
  camera && entity && entity.state !== 'unavailable'
    ? feedUrls(camera, entity.attributes)
    : {};

type Shown = {
  /** Bumped by every event, so a new ring restarts the countdown. */
  session: number;
  tileId: string;
  label: string;
  urls: FeedUrls;
  ringAt?: number;
  /** The ring entity's last-ring time while the ring is recent: what Dismiss hides. */
  ringEntityAt?: number;
  timeoutSeconds: number;
};

/**
 * The doorbell's camera over everything, on a ring or a tap on the door tile:
 * the live MJPEG stream, or snapshots when it fails (uncropped, portrait 3:4), when it rang, a countdown to
 * closing and a large Dismiss. While open it blocks auto-reload. A ring while open restarts the countdown, not a second
 * overlay. The picture is not greyed: the camera sends greyscale frames itself
 * when it switches to infrared (docs/doorbell.md).
 */
export const DoorbellOverlay = ({
  store = haStore,
  doorbell = appDoorbell,
  dismissals = appDismissals,
  cfg = getConfig(),
  now = Date.now,
}: {
  store?: HaStore;
  doorbell?: Doorbell;
  dismissals?: DoorDismissals;
  cfg?: Config;
  now?: () => number;
}) => {
  const [shown, setShown] = useState<Shown | undefined>();
  const [left, setLeft] = useState(0);

  useEffect(
    () =>
      doorbell.subscribe((event: DoorEvent) => {
        const tile = cfg.tiles.find(
          (t) => t.type === 'door' && t.id === event.tileId,
        );
        if (tile?.type !== 'door') return;
        const { entities } = store.getSnapshot();
        const { camera, ring } = tile.entities;
        const ringed = recentRing(
          entities[ring],
          now(),
          tile.recentMinutes * 60_000,
          dismissals.get(tile.id),
        );
        setShown((prev) => ({
          session: (prev?.session ?? 0) + 1,
          tileId: tile.id,
          label: tile.label,
          urls: cameraUrls(camera, entities[camera]),
          ringEntityAt: ringed,
          ringAt: ringed ?? (event.kind === 'ring' ? event.at : undefined),
          timeoutSeconds: tile.timeoutSeconds,
        }));
      }),
    [doorbell, dismissals, store, cfg, now],
  );

  const close = () => setShown(undefined);

  // Someone at the panel has seen the ring: the tile stops showing it. Closing
  // by timeout, tap or Escape does not.
  const dismiss = () => {
    if (shown?.ringEntityAt !== undefined)
      dismissals.dismiss(shown.tileId, shown.ringEntityAt);
    close();
  };

  // The access token rotates, so a retry reads it again.
  const retry = () =>
    setShown((prev) => {
      if (!prev) return prev;
      const camera = cameraOf(cfg, prev.tileId);
      const entity = camera ? store.getSnapshot().entities[camera] : undefined;
      return { ...prev, urls: cameraUrls(camera, entity) };
    });

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
      <div class="relative mx-auto aspect-[3/4] w-full max-w-[360px] shrink-0 overflow-hidden rounded-tile border border-line bg-surface min-[600px]:mx-0 min-[600px]:h-full min-[600px]:w-auto min-[600px]:max-w-none">
        <button
          type="button"
          aria-label="Close doorbell"
          onClick={close}
          class="absolute inset-0 size-full bg-surface"
        />
        <div class="pointer-events-none absolute inset-0">
          <CameraFeed
            key={shown.session}
            urls={shown.urls}
            label={shown.label}
            onRetry={retry}
            now={now}
          />
        </div>
      </div>
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
            onClick={dismiss}
          >
            Dismiss
          </button>
        </div>
      </div>
    </dialog>
  );
};

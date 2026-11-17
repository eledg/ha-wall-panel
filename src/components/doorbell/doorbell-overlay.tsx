import { useEffect, useState } from 'preact/hooks';

import { type Config, getConfig, type TileConfig } from '@/config/config.ts';
import { PACKAGE_INSET_SIZE, PACKAGE_LARGE_SIZE } from '@/config/constants.ts';
import {
  doorDismissals as appDismissals,
  type DoorDismissals,
} from '@/lib/door-dismissed.ts';
import { recentRing } from '@/lib/door.ts';
import { formatTime } from '@/lib/format.ts';
import type { Doorbell, DoorEvent } from '@/services/ha/doorbell.ts';
import { doorbell as appDoorbell, haStore } from '@/services/ha/instance.ts';
import type { HaStore } from '@/services/ha/store.ts';

import {
  CameraFeed,
  type FeedUrls,
  feedUrls,
  type StartWebRtc,
} from './camera-feed.tsx';
import { PackageCamera } from './package-camera.tsx';

/** A door tile by its id. */
const doorOf = (cfg: Config, tileId: string) => {
  const tile = cfg.tiles.find((t) => t.type === 'door' && t.id === tileId);
  return tile?.type === 'door' ? tile : undefined;
};

/** No URLs for a camera that is missing or unavailable, whatever stale attributes it keeps. */
const cameraUrls = (
  camera: string,
  entity: { state: string; attributes: Record<string, unknown> } | undefined,
): FeedUrls =>
  entity && entity.state !== 'unavailable'
    ? feedUrls(camera, entity.attributes)
    : {};

/** What the feed may use, by the tile's `liveView`: WebRTC first, then MJPEG, then snapshots. */
const feedOf = (tile: TileConfig<'door'>, store: HaStore) => {
  const { camera } = tile.entities;
  const urls = cameraUrls(camera, store.getSnapshot().entities[camera]);
  return {
    urls: tile.liveView === 'snapshot' ? { snapshot: urls.snapshot } : urls,
    webrtc:
      tile.liveView === 'webrtc'
        ? (handlers: Parameters<StartWebRtc>[0]) =>
            store.webrtc(camera, handlers)
        : undefined,
  };
};

type Shown = {
  /** Bumped by every event, so a new ring restarts the countdown. */
  session: number;
  tileId: string;
  label: string;
  urls: FeedUrls;
  webrtc?: StartWebRtc;
  /** The tile's package camera, if it has one. */
  packageCamera?: string;
  /** Which camera is the large picture; a new event goes back to the visitor. */
  large: 'visitor' | 'package';
  ringAt?: number;
  /** The ring entity's last-ring time while the ring is recent: what Dismiss hides. */
  ringEntityAt?: number;
  timeoutSeconds: number;
};

/** The box both cameras share: large on the left, or small at the top right. */
const BOX =
  'relative shrink-0 overflow-hidden rounded-tile border border-line bg-surface';
const LARGE =
  'order-first mx-auto w-full min-[600px]:mx-0 min-[600px]:h-full min-[600px]:w-auto min-[600px]:max-w-none';
const SMALL = 'min-[600px]:absolute min-[600px]:right-4 min-[600px]:top-4';
const VISITOR_BOX = {
  large: `${BOX} aspect-[3/4] max-w-[360px] ${LARGE}`,
  small: `${BOX} aspect-[3/4] mx-auto w-[135px] min-[600px]:h-[180px] ${SMALL}`,
};
const PACKAGE_BOX = {
  large: `${BOX} aspect-[4/3] max-w-[548px] ${LARGE}`,
  small: `${BOX} aspect-[4/3] w-full min-[600px]:h-[180px] min-[600px]:w-[240px] ${SMALL}`,
};
/** Room beside the heading for the small box, which sits over the top right. */
const HEADING_ROOM = {
  visitor: 'min-[600px]:pr-[151px]',
  package: 'min-[600px]:pr-[256px]',
};

/**
 * The doorbell's camera over everything, on a ring or a tap on the door tile:
 * the live view by the tile's `liveView` (WebRTC, then MJPEG, then snapshots;
 * uncropped, portrait 3:4), when it rang, a countdown to
 * closing and a large Dismiss. With a `packageCamera` its still sits beside
 * the heading once the main camera shows its first picture; a tap swaps the
 * two. The boxes swap places by their classes alone, so the live view is not
 * restarted. While open it blocks auto-reload. A ring while open restarts the countdown, not a second
 * overlay. The picture is not greyed: the camera sends greyscale frames itself
 * when it switches to infrared (docs/doorbell.md).
 */
export const DoorbellOverlay = ({
  store = haStore,
  doorbell = appDoorbell,
  dismissals = appDismissals,
  cfg,
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
  // The session whose main camera has shown a picture: the package camera waits for it.
  const [pictured, setPictured] = useState<number | undefined>();
  useEffect(
    () =>
      doorbell.subscribe((event: DoorEvent) => {
        // Read on each event, not kept: the mock can change it while the panel runs.
        const tile = (cfg ?? getConfig()).tiles.find(
          (t) => t.type === 'door' && t.id === event.tileId,
        );
        if (tile?.type !== 'door') return;
        const { entities } = store.getSnapshot();
        const { ring } = tile.entities;
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
          ...feedOf(tile, store),
          packageCamera: tile.entities.packageCamera,
          large: 'visitor',
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
      const tile = doorOf(cfg ?? getConfig(), prev.tileId);
      return tile ? { ...prev, ...feedOf(tile, store) } : prev;
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

  const swap = () =>
    setShown(
      (prev) =>
        prev && {
          ...prev,
          large: prev.large === 'visitor' ? 'package' : 'visitor',
        },
    );

  if (!shown) return null;
  const packageLarge =
    shown.packageCamera !== undefined && shown.large === 'package';
  let headingRoom = '';
  if (shown.packageCamera !== undefined)
    headingRoom = packageLarge ? HEADING_ROOM.visitor : HEADING_ROOM.package;
  const closeButton = (
    <button
      type="button"
      aria-label="Close doorbell"
      onClick={close}
      class="absolute inset-0 size-full bg-surface"
    />
  );
  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby="doorbell-title"
      data-blocks-reload
      class="fixed inset-0 m-0 flex size-full max-h-none max-w-none flex-col gap-4 overflow-y-auto border-0 bg-bg p-4 text-fg z-50 min-[600px]:flex-row"
    >
      <div class={packageLarge ? VISITOR_BOX.small : VISITOR_BOX.large}>
        {packageLarge ? (
          <button
            type="button"
            aria-label="Enlarge visitor camera"
            onClick={swap}
            class="absolute inset-0 size-full bg-surface"
          />
        ) : (
          closeButton
        )}
        <div class="pointer-events-none absolute inset-0">
          <CameraFeed
            key={shown.session}
            urls={shown.urls}
            webrtc={shown.webrtc}
            label={shown.label}
            onRetry={retry}
            onFirstPicture={() => setPictured(shown.session)}
            now={now}
          />
          {packageLarge && (
            <span class="absolute bottom-2 left-2 rounded bg-bg/70 px-2 py-1 text-sm text-fg">
              Visitor
            </span>
          )}
        </div>
      </div>
      {shown.packageCamera !== undefined && (
        <div class={packageLarge ? PACKAGE_BOX.large : PACKAGE_BOX.small}>
          {packageLarge && closeButton}
          <div
            class={`absolute inset-0 ${packageLarge ? 'pointer-events-none' : ''}`}
          >
            <PackageCamera
              key={shown.session}
              camera={shown.packageCamera}
              store={store}
              size={packageLarge ? PACKAGE_LARGE_SIZE : PACKAGE_INSET_SIZE}
              active={pictured === shown.session}
              large={packageLarge}
              onEnlarge={swap}
              now={now}
            />
          </div>
        </div>
      )}
      <div class="flex min-w-0 flex-1 flex-col justify-between gap-4">
        <div class={headingRoom}>
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

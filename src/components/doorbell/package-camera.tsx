import { useEffect, useRef, useState } from 'preact/hooks';

import { CameraIcon } from '@/components/icons/camera-icon.tsx';
import { PACKAGE_REFRESH_MS, PACKAGE_STALE_MS } from '@/config/constants.ts';
import { formatTimeSeconds } from '@/lib/format.ts';
import type { HaStore } from '@/services/ha/store.ts';

export type PackageSize = { width: number; height: number };

/**
 * The package camera's still, scaled by HA to `size`. HA only scales when both
 * `width` and `height` are given (and the camera serves JPEG); a full-size
 * snapshot (3264 x 2448 on the G6 Entry) is far too large to fetch every few
 * seconds. Built from the current `access_token`, which rotates. Without one
 * (the mock's placeholder) it is the entity's own `entity_picture`.
 */
export const packageSnapshotUrl = (
  camera: string,
  attributes: Record<string, unknown> | undefined,
  { width, height }: PackageSize,
): string | undefined => {
  const token = attributes?.access_token;
  if (typeof token === 'string' && token !== '')
    return `/api/camera_proxy/${camera}?token=${encodeURIComponent(token)}&width=${width}&height=${height}`;
  const picture = attributes?.entity_picture;
  return typeof picture === 'string' ? picture : undefined;
};

/**
 * Runs `load` now, then again `intervalMs` after each one settles, so two loads
 * never overlap. The returned stop clears the timer and aborts the load in
 * flight. `load` reports its own results; a rejection only ends that round.
 */
export const startRefresh = (
  load: (signal: AbortSignal) => Promise<void>,
  intervalMs: number,
) => {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  const round = async () => {
    controller = new AbortController();
    try {
      await load(controller.signal);
    } catch {
      // The next round tries again.
    }
    if (!stopped) timer = setTimeout(() => void round(), intervalMs);
  };
  void round();
  return () => {
    stopped = true;
    clearTimeout(timer);
    controller?.abort();
  };
};

/** Fetches an image as an object URL, which the caller revokes. */
const fetchImage = async (url: string, signal: AbortSignal) => {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return URL.createObjectURL(await res.blob());
};

type Still = { src: string; at: number };

/**
 * The package camera as a refreshing still: fetched every `PACKAGE_REFRESH_MS`
 * after the last one finished, never two at once, while `active`. Unmounting
 * (the overlay closing) stops it and aborts the request in flight. If the
 * entity is unavailable or a fetch fails it shows "Package camera unavailable"
 * and keeps trying, so it recovers on its own.
 */
export const PackageCamera = ({
  camera,
  store,
  size,
  active,
  large = false,
  onEnlarge,
  now = Date.now,
  fetchUrl = fetchImage,
}: {
  camera: string;
  store: HaStore;
  size: PackageSize;
  /** False until the main camera's first picture, so it never slows that down. */
  active: boolean;
  /** Shown as the large picture: the Close button covers it instead of Enlarge. */
  large?: boolean;
  onEnlarge?: () => void;
  now?: () => number;
  fetchUrl?: (url: string, signal: AbortSignal) => Promise<string>;
}) => {
  const [still, setStill] = useState<Still | undefined>();
  const [failed, setFailed] = useState(false);
  // The object URL on show, revoked once replaced. It outlives a restart of
  // the loop (a new size), so the picture stays until the next one arrives.
  const ownedRef = useRef<string | undefined>(undefined);

  const { width, height } = size;
  useEffect(() => {
    if (!active) return;
    const show = (src: string, blob: boolean) => {
      if (ownedRef.current) URL.revokeObjectURL(ownedRef.current);
      ownedRef.current = blob ? src : undefined;
      setStill(src ? { src, at: now() } : undefined);
    };
    const stop = startRefresh(async (signal) => {
      const entity = store.getSnapshot().entities[camera];
      const url =
        entity && entity.state !== 'unavailable'
          ? packageSnapshotUrl(camera, entity.attributes, { width, height })
          : undefined;
      try {
        if (!url) throw new Error('unavailable');
        if (url.startsWith('/')) show(await fetchUrl(url, signal), true);
        else show(url, false);
        setFailed(false);
      } catch (error) {
        if (signal.aborted) return;
        show('', false);
        setFailed(true);
        throw error;
      }
    }, PACKAGE_REFRESH_MS);
    return stop;
  }, [active, camera, store, width, height, fetchUrl, now]);

  // One re-render when the still turns old, in case the next one is slow.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!still) return;
    const timer = setTimeout(() => setTick((n) => n + 1), PACKAGE_STALE_MS + 1);
    return () => clearTimeout(timer);
  }, [still]);

  useEffect(
    () => () => {
      if (ownedRef.current) URL.revokeObjectURL(ownedRef.current);
    },
    [],
  );

  const picture = (
    <>
      {still && (
        <img
          src={still.src}
          alt="Doorstep package camera"
          class="absolute inset-0 size-full object-contain"
        />
      )}
      {still && (
        <span class="absolute left-2 top-2 rounded-full bg-bg/70 px-3 py-1 text-sm text-fg">
          Doorstep · Still
        </span>
      )}
      {still && now() - still.at > PACKAGE_STALE_MS && (
        <span class="tnum absolute bottom-2 left-2 rounded bg-bg/70 px-2 py-1 text-sm text-fg-dim">
          Updated {formatTimeSeconds(still.at)}
        </span>
      )}
      {!still && failed && (
        <div class="absolute inset-0 grid place-items-center p-3 text-center text-fg-dim">
          Package camera unavailable
        </div>
      )}
      {!still && !failed && (
        <output
          aria-label="Package camera loading"
          class="absolute inset-0 grid place-items-center text-fg-dim"
        >
          <CameraIcon />
        </output>
      )}
    </>
  );

  if (large || !still || !onEnlarge) return picture;
  return (
    <button
      type="button"
      aria-label="Enlarge doorstep camera"
      onClick={onEnlarge}
      class="tap absolute inset-0 size-full bg-surface"
    >
      {picture}
    </button>
  );
};

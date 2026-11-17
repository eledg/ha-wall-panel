import { useEffect, useRef, useState } from 'preact/hooks';

import { SNAPSHOT_REFRESH_MS, STREAM_STALL_MS } from '@/config/constants.ts';

export type FeedUrls = { snapshot?: string; stream?: string };

/**
 * `connecting` until the first frame, `live` on the stream, `degraded` on
 * snapshots, `failed` when there is no picture to show.
 */
type FeedState = 'connecting' | 'live' | 'degraded' | 'failed';

const BADGE: Record<FeedState, string> = {
  connecting: 'Connecting',
  live: '● Live',
  degraded: 'Snapshot mode',
  failed: 'Camera unavailable',
};

/**
 * The camera URLs. The access token rotates about every 5 minutes, so it is
 * read when the overlay opens, not kept. Without one (the mock's placeholder
 * has none) there is no stream, and the entity's own `entity_picture` is the
 * snapshot.
 */
export const feedUrls = (
  camera: string,
  attributes: Record<string, unknown> | undefined,
): FeedUrls => {
  const token = attributes?.access_token;
  if (typeof token === 'string' && token !== '') {
    const query = `?token=${encodeURIComponent(token)}`;
    return {
      snapshot: `/api/camera_proxy/${camera}${query}`,
      stream: `/api/camera_proxy_stream/${camera}${query}`,
    };
  }
  const picture = attributes?.entity_picture;
  return { snapshot: typeof picture === 'string' ? picture : undefined };
};

/** A snapshot URL the browser will fetch again; inline images are left as they are. */
const refreshed = (url: string, n: number) => {
  if (n === 0 || !url.startsWith('/')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}t=${n}`;
};

/** The last frame that loaded, copied so it outlives the rotating access token. */
type Frame = { src: string; at: number };

/** A copy of a loaded image as a data URL, or undefined where canvas is unavailable. */
const snapshotOf = (img: HTMLImageElement): string | undefined => {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx || canvas.width === 0) return undefined;
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch {
    return undefined;
  }
};

const ageLabel = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.round(s / 60)}m`;
};

/**
 * HA's MJPEG stream in an `<img>`, with the snapshot as the fallback: if the
 * stream errors, or shows no frame within `STREAM_STALL_MS`, the picture is the
 * snapshot, refreshed every `SNAPSHOT_REFRESH_MS`. If the snapshot fails too (or
 * there is no camera) the feed is `failed`: "Camera unavailable" with Retry, and
 * the last good frame marked with its age when there was one. Unmounting empties
 * `src`, so the browser drops the stream's connection.
 */
export const CameraFeed = ({
  urls,
  label,
  onRetry,
  now = Date.now,
}: {
  urls: FeedUrls;
  label: string;
  /** Called by Retry, so the caller can pass fresh `urls` (the token rotates). */
  onRetry?: () => void;
  now?: () => number;
}) => {
  const initial = (u: FeedUrls): FeedState => {
    if (u.stream) return 'connecting';
    return u.snapshot ? 'degraded' : 'failed';
  };
  const [state, setState] = useState<FeedState>(initial(urls));
  const [refresh, setRefresh] = useState(0);
  const [frame, setFrame] = useState<Frame | undefined>();
  const [, setTick] = useState(0);
  const img = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (state !== 'connecting') return;
    const timer = setTimeout(() => setState('degraded'), STREAM_STALL_MS);
    return () => clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    if (state !== 'degraded') return;
    const timer = setInterval(
      () => setRefresh((n) => n + 1),
      SNAPSHOT_REFRESH_MS,
    );
    return () => clearInterval(timer);
  }, [state]);

  // Re-render each second while failed, so the age of the last frame counts up.
  useEffect(() => {
    if (state !== 'failed' || !frame) return;
    const timer = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [state, frame]);

  useEffect(() => {
    const el = img.current;
    return () => el?.removeAttribute('src');
  }, []);

  const retry = () => {
    onRetry?.();
    setRefresh(0);
    setState(initial(urls));
  };

  if (state === 'failed')
    return (
      <div class="relative grid size-full place-items-center">
        {frame && (
          <img
            src={frame.src}
            alt={`${label} camera, last frame`}
            class="absolute inset-0 size-full object-contain opacity-60"
          />
        )}
        <div class="relative flex flex-col items-center gap-3 text-fg">
          <span class="text-fg-dim">Camera unavailable</span>
          {frame && (
            <span class="tnum text-sm text-fg-dim">
              Last frame {ageLabel(now() - frame.at)} ago
            </span>
          )}
          <button
            type="button"
            class="tap pointer-events-auto rounded-full bg-surface-2 px-6 py-3 text-lg font-semibold text-fg"
            onClick={retry}
          >
            Retry
          </button>
        </div>
      </div>
    );

  const src =
    state === 'degraded' && urls.snapshot
      ? refreshed(urls.snapshot, refresh)
      : urls.stream;
  return (
    <>
      <img
        ref={img}
        src={src}
        alt={`${label} camera`}
        class="size-full object-contain"
        onLoad={(e) => {
          setState((s) => (s === 'connecting' ? 'live' : s));
          const copy = snapshotOf(e.currentTarget);
          if (copy) setFrame({ src: copy, at: now() });
        }}
        onError={() =>
          setState((s) =>
            s === 'degraded' || !urls.snapshot ? 'failed' : 'degraded',
          )
        }
      />
      <span class="absolute left-2 top-2 rounded-full bg-bg/70 px-3 py-1 text-sm text-fg">
        {BADGE[state]}
      </span>
    </>
  );
};

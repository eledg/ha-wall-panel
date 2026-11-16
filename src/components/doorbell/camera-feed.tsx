import { useEffect, useRef, useState } from 'preact/hooks';

import { SNAPSHOT_REFRESH_MS, STREAM_STALL_MS } from '@/config/constants.ts';

export type FeedUrls = { snapshot?: string; stream?: string };

/** `connecting` until the first frame, `live` on the stream, `degraded` on snapshots. */
type FeedState = 'connecting' | 'live' | 'degraded';

const BADGE: Record<FeedState, string> = {
  connecting: 'Connecting',
  live: '● Live',
  degraded: 'Snapshot mode',
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
const refreshed = (url: string, n: number) =>
  n === 0 || !url.startsWith('/')
    ? url
    : `${url}${url.includes('?') ? '&' : '?'}t=${n}`;

/**
 * HA's MJPEG stream in an `<img>`, with the snapshot as the fallback: if the
 * stream errors, or shows no frame within `STREAM_STALL_MS`, the picture is the
 * snapshot, refreshed every `SNAPSHOT_REFRESH_MS`. Unmounting empties `src`, so
 * the browser drops the stream's connection.
 */
export const CameraFeed = ({
  urls,
  label,
}: {
  urls: FeedUrls;
  label: string;
}) => {
  const [state, setState] = useState<FeedState>(
    urls.stream ? 'connecting' : 'degraded',
  );
  const [refresh, setRefresh] = useState(0);
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

  useEffect(() => {
    const el = img.current;
    return () => el?.removeAttribute('src');
  }, []);

  const src =
    state === 'degraded' && urls.snapshot
      ? refreshed(urls.snapshot, refresh)
      : urls.stream;

  if (!src)
    return (
      <span class="grid size-full place-items-center text-fg-dim">
        Camera unavailable
      </span>
    );
  return (
    <>
      <img
        ref={img}
        src={src}
        alt={`${label} camera`}
        class="size-full object-contain"
        onLoad={() => setState((s) => (s === 'connecting' ? 'live' : s))}
        onError={() => setState('degraded')}
      />
      <span class="absolute left-2 top-2 rounded-full bg-bg/70 px-3 py-1 text-sm text-fg">
        {BADGE[state]}
      </span>
    </>
  );
};

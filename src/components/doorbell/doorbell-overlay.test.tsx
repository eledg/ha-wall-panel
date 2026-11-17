// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HaConnection } from '@/components/layout/ha-connection.tsx';
import type { Config, LiveView } from '@/config/config.ts';
import {
  PACKAGE_REFRESH_MS,
  SNAPSHOT_REFRESH_MS,
  STREAM_STALL_MS,
  WEBRTC_FRAME_MS,
} from '@/config/constants.ts';
import { mockConfig } from '@/dev/mock/config.ts';
import { createMockHa } from '@/dev/mock/engine.ts';
import { createDoorDismissals } from '@/lib/door-dismissed.ts';
import { createDoorbell } from '@/services/ha/doorbell.ts';
import { createHaStore, type HaStore } from '@/services/ha/store.ts';
import type { WebRtcHandlers } from '@/services/ha/webrtc.ts';
import { entityId, tileOf } from '@/tests/ids.ts';

import { DoorbellOverlay } from './doorbell-overlay.tsx';

const CAMERA = entityId('doorCamera');
const PACKAGE = entityId('doorPackageCamera');
const RING = entityId('doorRing');
const TILE = tileOf('door');

const screen = () => ({
  Dismiss: [...document.querySelectorAll('button')].find(
    (b) => b.textContent === 'Dismiss',
  )!,
});

/** The mock config with the door tile's live view set, with or without its package camera. */
const withLiveView = (liveView: LiveView, packageCamera = true): Config => ({
  ...mockConfig,
  tiles: mockConfig.tiles.map((t) => {
    if (t.type !== 'door') return t;
    const { packageCamera: _, ...entities } = t.entities;
    return { ...t, liveView, entities: packageCamera ? t.entities : entities };
  }),
});

/** Stands in for HA's camera proxy: every fetch of the package camera's still. */
const stubFetch = () => {
  const fetch = vi.fn((_url: string) =>
    Promise.resolve(new Response(new Blob(['jpeg']))),
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
};

/** Most tests are about the MJPEG stream; WebRTC has its own below. */
const setup = async (
  setToken?: string,
  now?: () => number,
  liveView: LiveView = 'mjpeg',
  packageCamera = true,
) => {
  const fetch = stubFetch();
  const mock = createMockHa();
  const store = createHaStore(mock.deps);
  const doorbell = createDoorbell(store);
  const dismissals = createDoorDismissals();
  await act(async () => {
    await store.start(mock.getAuth);
    if (setToken !== undefined)
      mock.controls.setState(CAMERA, 'idle', {
        access_token: setToken,
        entity_picture: `/api/camera_proxy/${CAMERA}?token=${setToken}`,
      });
    render(
      <HaConnection store={store}>
        <DoorbellOverlay
          store={store}
          doorbell={doorbell}
          dismissals={dismissals}
          cfg={withLiveView(liveView, packageCamera)}
          now={now}
        />
      </HaConnection>,
      document.body,
    );
  });
  const dialog = () => document.querySelector('dialog');
  return { mock, store, doorbell, dismissals, dialog, fetch };
};

afterEach(() => {
  render(null, document.body);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('DoorbellOverlay', () => {
  it('is closed until something happens', async () => {
    const { dialog } = await setup();
    expect(dialog()).toBeNull();
  });

  it('opens on a ring with the ring time and blocks reload', async () => {
    const { mock, dialog } = await setup();

    await act(() => mock.controls.ring());

    expect(dialog()?.textContent).toContain('Rang at');
    expect(dialog()?.hasAttribute('data-blocks-reload')).toBe(true);
  });

  it('opens on a tap with "Live view" when there was no recent ring', async () => {
    const { doorbell, dialog } = await setup();

    await act(() => doorbell.open(TILE.id));

    expect(dialog()?.textContent).toContain('Live view');
    expect(dialog()?.textContent).not.toContain('Rang at');
  });

  it('keeps the ring time when opened by a tap after a recent ring', async () => {
    const { mock, doorbell, dialog } = await setup();
    await act(() => mock.controls.ring());
    await act(() =>
      document
        .querySelector<HTMLButtonElement>(
          'button[aria-label="Close doorbell"]',
        )!
        .click(),
    );
    expect(dialog()).toBeNull();

    await act(() => doorbell.open(TILE.id));

    expect(dialog()?.textContent).toContain('Rang at');
  });

  it('streams from the camera with the access token at open time', async () => {
    const { doorbell, dialog } = await setup('abc123');

    await act(() => doorbell.open(TILE.id));

    expect(dialog()?.querySelector('img')?.getAttribute('src')).toBe(
      `/api/camera_proxy_stream/${CAMERA}?token=abc123`,
    );
    expect(dialog()?.textContent).toContain('Connecting');
    expect(dialog()?.querySelector('img')?.className).not.toContain(
      'grayscale',
    );
  });

  it('shows Live on the first frame', async () => {
    const { doorbell, dialog } = await setup('abc123');
    await act(() => doorbell.open(TILE.id));

    await act(() => {
      dialog()?.querySelector('img')?.dispatchEvent(new Event('load'));
    });

    expect(dialog()?.textContent).toContain('● Live');
  });

  it('falls back to snapshots, refreshed every second, when the stream errors', async () => {
    vi.useFakeTimers();
    const { doorbell, dialog } = await setup('abc123');
    await act(() => doorbell.open(TILE.id));

    await act(() => {
      dialog()?.querySelector('img')?.dispatchEvent(new Event('error'));
    });
    const src = () => dialog()?.querySelector('img')?.getAttribute('src');
    expect(dialog()?.textContent).toContain('Snapshot mode');
    expect(src()).toBe(`/api/camera_proxy/${CAMERA}?token=abc123`);

    await act(() => {
      vi.advanceTimersByTime(SNAPSHOT_REFRESH_MS);
    });
    expect(src()).toBe(`/api/camera_proxy/${CAMERA}?token=abc123&t=1`);
  });

  it('falls back to snapshots when no frame arrives in time', async () => {
    vi.useFakeTimers();
    const { doorbell, dialog } = await setup('abc123');
    await act(() => doorbell.open(TILE.id));

    await act(() => {
      vi.advanceTimersByTime(STREAM_STALL_MS);
    });

    expect(dialog()?.textContent).toContain('Snapshot mode');
  });

  it('empties the picture source when it closes, so the stream is released', async () => {
    const { doorbell, dialog } = await setup('abc123');
    await act(() => doorbell.open(TILE.id));
    const img = dialog()!.querySelector('img')!;

    await act(() => screen().Dismiss.click());

    expect(dialog()).toBeNull();
    expect(img.hasAttribute('src')).toBe(false);
  });

  it('closes on timeout', async () => {
    vi.useFakeTimers();
    const { doorbell, dialog } = await setup();
    await act(() => doorbell.open(TILE.id));

    await act(() => {
      vi.advanceTimersByTime((TILE.timeoutSeconds - 1) * 1000);
    });
    expect(dialog()).not.toBeNull();
    await act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(dialog()).toBeNull();
  });

  it('restarts the countdown on a new ring instead of stacking', async () => {
    vi.useFakeTimers();
    const { doorbell, dialog } = await setup();
    await act(() => doorbell.open(TILE.id));
    await act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(dialog()?.textContent).toContain(
      `Auto-close ${TILE.timeoutSeconds - 30}s`,
    );

    await act(() => doorbell.open(TILE.id));

    expect(document.querySelectorAll('dialog')).toHaveLength(1);
    expect(dialog()?.textContent).toContain(
      `Auto-close ${TILE.timeoutSeconds}s`,
    );
  });

  it('closes on Dismiss and on a tap of the picture', async () => {
    const { doorbell, dialog } = await setup();
    await act(() => doorbell.open(TILE.id));
    await act(() => screen().Dismiss.click());
    expect(dialog()).toBeNull();

    await act(() => doorbell.open(TILE.id));
    await act(() =>
      document
        .querySelector<HTMLButtonElement>(
          'button[aria-label="Close doorbell"]',
        )!
        .click(),
    );
    expect(dialog()).toBeNull();
  });

  it('remembers the ring on Dismiss, not when it closes by timeout', async () => {
    vi.useFakeTimers();
    const { mock, store, doorbell, dismissals, dialog } = await setup();
    await act(() => mock.controls.ring());
    const rangAt = Date.parse(store.getSnapshot().entities[RING]!.state);

    await act(async () => {
      vi.advanceTimersByTime(TILE.timeoutSeconds * 1000);
    });
    expect(dialog()).toBeNull();
    expect(dismissals.get(TILE.id)).toBeUndefined();

    await act(() => doorbell.open(TILE.id));
    await act(() => screen().Dismiss.click());
    expect(dismissals.get(TILE.id)).toBe(rangAt);

    await act(() => doorbell.open(TILE.id));
    expect(dialog()?.textContent).toContain('Live view');
  });

  describe('failures', () => {
    const retryButton = () =>
      [...document.querySelectorAll('button')].find(
        (b) => b.textContent === 'Retry',
      );

    it('opens on a ring and says the camera is unavailable', async () => {
      const { mock, dialog } = await setup();
      await act(() => mock.controls.setUnavailable(CAMERA));
      await act(() => mock.controls.ring());
      expect(dialog()?.textContent).toContain('Camera unavailable');
      expect(dialog()?.textContent).toContain('Rang at');
      expect(retryButton()).toBeTruthy();
      expect(dialog()?.querySelector('img')).toBeNull();
    });

    it('opens on a ring when the camera entity is missing', async () => {
      const { mock, dialog } = await setup();
      await act(() => mock.controls.removeEntity(CAMERA));
      await act(() => mock.controls.ring());
      expect(dialog()?.textContent).toContain('Camera unavailable');
      expect(retryButton()).toBeTruthy();
    });

    it('fails when the stream and the snapshot both fail, and Retry recovers', async () => {
      vi.useFakeTimers();
      const { mock, doorbell, dialog } = await setup('dead');
      await act(() => doorbell.open(TILE.id));
      const img = () => dialog()!.querySelector('img')!;
      await act(() => {
        img().dispatchEvent(new Event('error'));
      });
      expect(dialog()?.textContent).toContain('Snapshot mode');
      await act(() => {
        img().dispatchEvent(new Event('error'));
      });
      expect(dialog()?.textContent).toContain('Camera unavailable');
      expect(retryButton()).toBeTruthy();

      // The token has rotated by the time Retry is tapped.
      await act(() =>
        mock.controls.setState(CAMERA, 'idle', { access_token: 'fresh' }),
      );
      await act(() => retryButton()!.click());
      expect(img().getAttribute('src')).toContain('token=fresh');
      expect(retryButton()).toBeUndefined();
    });

    it('marks the last good frame with its age', async () => {
      vi.useFakeTimers();
      let at = 1_000_000;
      const { doorbell, dialog } = await setup('dead', () => at);
      const draw = vi
        .spyOn(HTMLCanvasElement.prototype, 'getContext')
        .mockReturnValue({ drawImage: vi.fn() } as never);
      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
        'data:image/jpeg;base64,AAAA',
      );
      vi.spyOn(
        HTMLImageElement.prototype,
        'naturalWidth',
        'get',
      ).mockReturnValue(768);
      await act(() => doorbell.open(TILE.id));
      const img = () => dialog()!.querySelector('img')!;
      await act(() => {
        img().dispatchEvent(new Event('error'));
      });
      await act(() => {
        img().dispatchEvent(new Event('load'));
      });
      expect(draw).toHaveBeenCalled();
      at += 12_000;
      await act(() => {
        img().dispatchEvent(new Event('error'));
      });
      expect(dialog()?.textContent).toContain('Camera unavailable');
      expect(dialog()?.querySelector('img')?.getAttribute('src')).toBe(
        'data:image/jpeg;base64,AAAA',
      );
      expect(dialog()?.textContent).toContain('Last frame 12s ago');
    });
  });

  describe('WebRTC', () => {
    /** Stands in for the store's WebRTC, recording each session. */
    const fakeWebRtc = (store: HaStore) => {
      const sessions: (WebRtcHandlers & { close: () => void })[] = [];
      vi.spyOn(store, 'webrtc').mockImplementation((_camera, handlers) => {
        const session = { ...handlers, close: vi.fn() };
        sessions.push(session);
        return session;
      });
      return sessions;
    };
    const streamSrc = `/api/camera_proxy_stream/${CAMERA}?token=abc123`;
    const imgSrc = () =>
      document.querySelector('dialog img')?.getAttribute('src');

    it('shows the snapshot, then the video on its first frame', async () => {
      const { store, doorbell, dialog } = await setup(
        'abc123',
        undefined,
        'webrtc',
      );
      const sessions = fakeWebRtc(store);
      await act(() => doorbell.open(TILE.id));

      expect(store.webrtc).toHaveBeenCalledWith(CAMERA, expect.anything());
      expect(imgSrc()).toBe(`/api/camera_proxy/${CAMERA}?token=abc123`);
      expect(dialog()?.textContent).toContain('Connecting');
      const video = dialog()!.querySelector('video')!;
      expect(video.className).toContain('invisible');
      expect(video.muted).toBe(true);

      await act(() => {
        sessions[0]!.onStream(new MediaStream());
        video.dispatchEvent(new Event('loadeddata'));
      });

      expect(dialog()?.textContent).toContain('● Live');
      expect(video.className).not.toContain('invisible');
      expect(dialog()?.querySelector('img')).toBeNull();
    });

    it.each(['WebRTC unsupported', 'webrtc: streams: unknown error'])(
      'falls back to MJPEG when WebRTC fails: %s',
      async (reason) => {
        const { store, doorbell } = await setup('abc123', undefined, 'webrtc');
        const sessions = fakeWebRtc(store);
        await act(() => doorbell.open(TILE.id));

        await act(() => sessions[0]!.onFail(reason));

        expect(imgSrc()).toBe(streamSrc);
        expect(sessions[0]!.close).toHaveBeenCalled();
      },
    );

    it('falls back to MJPEG when no frame arrives in time', async () => {
      vi.useFakeTimers();
      const { store, doorbell } = await setup('abc123', undefined, 'webrtc');
      const sessions = fakeWebRtc(store);
      await act(() => doorbell.open(TILE.id));

      await act(() => {
        vi.advanceTimersByTime(WEBRTC_FRAME_MS - 1);
      });
      expect(imgSrc()).not.toBe(streamSrc);
      await act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(imgSrc()).toBe(streamSrc);
      expect(sessions[0]!.close).toHaveBeenCalled();
    });

    it('closes the peer connection on Dismiss', async () => {
      const { store, doorbell } = await setup('abc123', undefined, 'webrtc');
      const sessions = fakeWebRtc(store);
      await act(() => doorbell.open(TILE.id));

      await act(() => screen().Dismiss.click());

      expect(sessions[0]!.close).toHaveBeenCalled();
    });

    it('is not tried for an MJPEG or snapshot view', async () => {
      const mjpeg = await setup('abc123');
      const webrtc = vi.spyOn(mjpeg.store, 'webrtc');
      await act(() => mjpeg.doorbell.open(TILE.id));
      expect(imgSrc()).toBe(streamSrc);
      render(null, document.body);

      const snapshot = await setup('abc123', undefined, 'snapshot');
      const snapshotWebrtc = vi.spyOn(snapshot.store, 'webrtc');
      await act(() => snapshot.doorbell.open(TILE.id));
      expect(imgSrc()).toBe(`/api/camera_proxy/${CAMERA}?token=abc123`);
      expect(snapshot.dialog()?.textContent).toContain('Snapshot mode');

      expect(webrtc).not.toHaveBeenCalled();
      expect(snapshotWebrtc).not.toHaveBeenCalled();
    });

    // Through the mock HA's signalling, as `pnpm dev:mock` does.
    it.each(['unsupported', 'rejected'] as const)(
      'falls back to MJPEG when the mock camera is %s',
      async (mode) => {
        const { mock, doorbell } = await setup('abc123', undefined, 'webrtc');
        mock.controls.setWebRtc(mode);
        await act(() => doorbell.open(TILE.id));

        await vi.waitFor(() => expect(imgSrc()).toBe(streamSrc));
      },
    );

    it('falls back to MJPEG when the mock camera never answers', async () => {
      vi.useFakeTimers();
      const { mock, doorbell } = await setup('abc123', undefined, 'webrtc');
      mock.controls.setWebRtc('silent');
      await act(() => doorbell.open(TILE.id));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(WEBRTC_FRAME_MS);
      });

      expect(imgSrc()).toBe(streamSrc);
    });
  });

  describe('package camera', () => {
    const button = (label: string) =>
      document.querySelector<HTMLButtonElement>(
        `button[aria-label="${label}"]`,
      );
    const mainImg = () => document.querySelector('dialog img')!;
    const firstFrame = () =>
      act(() => {
        mainImg().dispatchEvent(new Event('load'));
      });
    const inset = `/api/camera_proxy/${PACKAGE}?token=mock&width=480&height=360`;

    it('is not there without the role', async () => {
      const { doorbell, dialog, fetch } = await setup(
        'abc123',
        undefined,
        'mjpeg',
        false,
      );
      await act(() => doorbell.open(TILE.id));
      await firstFrame();

      expect(dialog()?.textContent).not.toContain('Package camera');
      expect(
        dialog()?.querySelector('[aria-label="Package camera loading"]'),
      ).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });

    it("waits for the main camera's first picture", async () => {
      const { doorbell, dialog, fetch } = await setup('abc123');
      await act(() => doorbell.open(TILE.id));

      expect(
        dialog()?.querySelector('[aria-label="Package camera loading"]'),
      ).not.toBeNull();
      expect(fetch).not.toHaveBeenCalled();

      await firstFrame();
      await vi.waitFor(() =>
        expect(dialog()?.textContent).toContain('Doorstep · Still'),
      );
      expect(fetch).toHaveBeenCalledWith(inset, expect.anything());
    });

    it('shows unavailable without touching the main feed', async () => {
      const { mock, doorbell, dialog, fetch } = await setup('abc123');
      mock.controls.setUnavailable(PACKAGE);
      await act(() => doorbell.open(TILE.id));
      await firstFrame();

      await vi.waitFor(() =>
        expect(dialog()?.textContent).toContain('Package camera unavailable'),
      );
      expect(fetch).not.toHaveBeenCalled();
      expect(dialog()?.textContent).toContain('● Live');
      expect(mainImg().getAttribute('src')).toBe(
        `/api/camera_proxy_stream/${CAMERA}?token=abc123`,
      );
    });

    it('swaps with the main picture, keeping the live view and the countdown', async () => {
      const { doorbell, dialog, fetch } = await setup('abc123');
      await act(() => doorbell.open(TILE.id));
      await firstFrame();
      const visitor = mainImg();
      await vi.waitFor(() =>
        expect(button('Enlarge doorstep camera')).not.toBeNull(),
      );

      await act(() => button('Enlarge doorstep camera')!.click());

      expect(button('Enlarge visitor camera')).not.toBeNull();
      expect(dialog()?.textContent).toContain('Visitor');
      expect(mainImg()).toBe(visitor);
      await vi.waitFor(() =>
        expect(fetch).toHaveBeenLastCalledWith(
          `/api/camera_proxy/${PACKAGE}?token=mock&width=1280&height=960`,
          expect.anything(),
        ),
      );
      expect(dialog()?.textContent).toContain(
        `Auto-close ${TILE.timeoutSeconds}s`,
      );

      await act(() => button('Enlarge visitor camera')!.click());
      expect(button('Enlarge visitor camera')).toBeNull();
      expect(mainImg()).toBe(visitor);
    });

    it('goes back to the visitor on a new ring', async () => {
      const { mock, doorbell } = await setup('abc123');
      await act(() => doorbell.open(TILE.id));
      await firstFrame();
      await vi.waitFor(() =>
        expect(button('Enlarge doorstep camera')).not.toBeNull(),
      );
      await act(() => button('Enlarge doorstep camera')!.click());

      await act(() => mock.controls.ring());

      expect(button('Enlarge visitor camera')).toBeNull();
    });

    it('stops fetching when the overlay closes', async () => {
      vi.useFakeTimers();
      const { doorbell, fetch } = await setup('abc123');
      await act(() => doorbell.open(TILE.id));
      await firstFrame();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      const calls = fetch.mock.calls.length;
      expect(calls).toBeGreaterThan(0);

      await act(() => screen().Dismiss.click());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PACKAGE_REFRESH_MS * 3);
      });

      expect(fetch.mock.calls.length).toBe(calls);
    });
  });
});

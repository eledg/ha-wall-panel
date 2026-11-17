// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HaConnection } from '@/components/layout/ha-connection.tsx';
import { SNAPSHOT_REFRESH_MS, STREAM_STALL_MS } from '@/config/constants.ts';
import { mockConfig } from '@/dev/mock/config.ts';
import { createMockHa } from '@/dev/mock/engine.ts';
import { createDoorDismissals } from '@/lib/door-dismissed.ts';
import { createDoorbell } from '@/services/ha/doorbell.ts';
import { createHaStore } from '@/services/ha/store.ts';
import { entityId, tileOf } from '@/tests/ids.ts';

import { DoorbellOverlay } from './doorbell-overlay.tsx';

const CAMERA = entityId('doorCamera');
const RING = entityId('doorRing');
const TILE = tileOf('door');

const screen = () => ({
  Dismiss: [...document.querySelectorAll('button')].find(
    (b) => b.textContent === 'Dismiss',
  )!,
});

const setup = async (setToken?: string, now?: () => number) => {
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
          cfg={mockConfig}
          now={now}
        />
      </HaConnection>,
      document.body,
    );
  });
  const dialog = () => document.querySelector('dialog');
  return { mock, store, doorbell, dismissals, dialog };
};

afterEach(() => {
  render(null, document.body);
  vi.useRealTimers();
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
});

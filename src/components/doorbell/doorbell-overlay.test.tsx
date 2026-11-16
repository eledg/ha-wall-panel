// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HaConnection } from '@/components/layout/ha-connection.tsx';
import { mockConfig } from '@/dev/mock/config.ts';
import { createMockHa } from '@/dev/mock/engine.ts';
import { NightHoldContext } from '@/hooks/night-hold.ts';
import { createDoorbell } from '@/services/ha/doorbell.ts';
import { createHaStore } from '@/services/ha/store.ts';
import { entityId, tileOf } from '@/tests/ids.ts';

import { DoorbellOverlay } from './doorbell-overlay.tsx';

const CAMERA = entityId('doorCamera');
const TILE = tileOf('door');

const screen = () => ({
  Dismiss: [...document.querySelectorAll('button')].find(
    (b) => b.textContent === 'Dismiss',
  )!,
});

const setup = async (setToken?: string) => {
  const mock = createMockHa();
  const store = createHaStore(mock.deps);
  const doorbell = createDoorbell(store);
  const holds = { active: 0 };
  const hold = () => {
    holds.active += 1;
    return () => {
      holds.active -= 1;
    };
  };
  await act(async () => {
    await store.start(mock.getAuth);
    if (setToken !== undefined)
      mock.controls.setState(CAMERA, 'idle', {
        access_token: setToken,
        entity_picture: `/api/camera_proxy/${CAMERA}?token=${setToken}`,
      });
    render(
      <NightHoldContext.Provider value={hold}>
        <HaConnection store={store}>
          <DoorbellOverlay store={store} doorbell={doorbell} cfg={mockConfig} />
        </HaConnection>
      </NightHoldContext.Provider>,
      document.body,
    );
  });
  const dialog = () => document.querySelector('dialog');
  return { mock, store, doorbell, holds, dialog };
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

  it('opens on a ring with the ring time, holds the night and blocks reload', async () => {
    const { mock, dialog, holds } = await setup();

    await act(() => mock.controls.ring());

    expect(dialog()?.textContent).toContain('Rang at');
    expect(dialog()?.hasAttribute('data-blocks-reload')).toBe(true);
    expect(holds.active).toBe(1);
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
    await act(() => screen().Dismiss.click());
    expect(dialog()).toBeNull();

    await act(() => doorbell.open(TILE.id));

    expect(dialog()?.textContent).toContain('Rang at');
  });

  it('builds the snapshot URL from the access token at open time', async () => {
    const { doorbell, dialog } = await setup('abc123');

    await act(() => doorbell.open(TILE.id));

    expect(dialog()?.querySelector('img')?.getAttribute('src')).toBe(
      `/api/camera_proxy/${CAMERA}?token=abc123`,
    );
    expect(dialog()?.querySelector('img')?.className).not.toContain(
      'grayscale',
    );
  });

  it('closes on timeout and releases the night hold', async () => {
    vi.useFakeTimers();
    const { doorbell, dialog, holds } = await setup();
    await act(() => doorbell.open(TILE.id));

    await act(() => {
      vi.advanceTimersByTime((TILE.timeoutSeconds - 1) * 1000);
    });
    expect(dialog()).not.toBeNull();
    await act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(dialog()).toBeNull();
    expect(holds.active).toBe(0);
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
});

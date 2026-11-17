// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  PACKAGE_INSET_SIZE,
  PACKAGE_REFRESH_MS,
  PACKAGE_STALE_MS,
} from '@/config/constants.ts';
import { createMockHa } from '@/dev/mock/engine.ts';
import { createHaStore } from '@/services/ha/store.ts';
import { entityId } from '@/tests/ids.ts';

import {
  PackageCamera,
  packageSnapshotUrl,
  startRefresh,
} from './package-camera.tsx';

const PACKAGE = entityId('doorPackageCamera');

/** A load that settles only when the test says so. */
const deferredLoads = () => {
  const pending: { resolve: () => void; signal: AbortSignal }[] = [];
  const load = vi.fn(
    (signal: AbortSignal) =>
      new Promise<void>((resolve) => pending.push({ resolve, signal })),
  );
  return { load, pending };
};

afterEach(() => {
  render(null, document.body);
  vi.useRealTimers();
});

describe('packageSnapshotUrl', () => {
  it('asks HA for a scaled still with the current token', () => {
    expect(
      packageSnapshotUrl(
        'camera.step',
        { access_token: 'a b' },
        { width: 480, height: 360 },
      ),
    ).toBe('/api/camera_proxy/camera.step?token=a%20b&width=480&height=360');
  });

  it("falls back to the entity's picture without a token", () => {
    expect(
      packageSnapshotUrl(
        'camera.step',
        { entity_picture: 'data:image/svg+xml,x' },
        PACKAGE_INSET_SIZE,
      ),
    ).toBe('data:image/svg+xml,x');
    expect(
      packageSnapshotUrl('camera.step', undefined, PACKAGE_INSET_SIZE),
    ).toBeUndefined();
  });
});

describe('startRefresh', () => {
  it('waits for a load to finish before scheduling the next', async () => {
    vi.useFakeTimers();
    const { load, pending } = deferredLoads();
    const stop = startRefresh(load, PACKAGE_REFRESH_MS);
    expect(load).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(PACKAGE_REFRESH_MS * 3);
    expect(load).toHaveBeenCalledTimes(1);

    pending[0]!.resolve();
    await vi.advanceTimersByTimeAsync(PACKAGE_REFRESH_MS - 1);
    expect(load).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(load).toHaveBeenCalledTimes(2);
    stop();
  });

  it('keeps going after a failed load', async () => {
    vi.useFakeTimers();
    const load = vi.fn(() => Promise.reject(new Error('HTTP 500')));
    const stop = startRefresh(load, PACKAGE_REFRESH_MS);

    await vi.advanceTimersByTimeAsync(PACKAGE_REFRESH_MS * 2);

    expect(load).toHaveBeenCalledTimes(3);
    stop();
  });

  it('aborts the load in flight and schedules nothing more when stopped', async () => {
    vi.useFakeTimers();
    const { load, pending } = deferredLoads();
    const stop = startRefresh(load, PACKAGE_REFRESH_MS);

    stop();
    expect(pending[0]!.signal.aborted).toBe(true);
    pending[0]!.resolve();
    await vi.advanceTimersByTimeAsync(PACKAGE_REFRESH_MS * 3);

    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe('PackageCamera', () => {
  const setup = async (active = true) => {
    vi.useFakeTimers();
    const mock = createMockHa();
    const store = createHaStore(mock.deps);
    const fetchUrl = vi.fn((url: string, _signal?: AbortSignal) =>
      Promise.resolve(`blob:${url}`),
    );
    let now = 1_000_000;
    const view = (on: boolean) => (
      <PackageCamera
        camera={PACKAGE}
        store={store}
        size={PACKAGE_INSET_SIZE}
        active={on}
        onEnlarge={() => {}}
        now={() => now}
        fetchUrl={fetchUrl}
      />
    );
    await act(async () => {
      await store.start(mock.getAuth);
      mock.controls.setState(PACKAGE, 'idle', { access_token: 'one' });
      render(view(active), document.body);
    });
    return {
      mock,
      fetchUrl,
      rerender: (on: boolean) => act(() => render(view(on), document.body)),
      advance: async (ms: number) => {
        now += ms;
        await act(async () => {
          await vi.advanceTimersByTimeAsync(ms);
        });
      },
    };
  };
  const text = () => document.body.textContent;

  it('fetches nothing until active, and shows a loading state', async () => {
    const { fetchUrl, rerender } = await setup(false);

    expect(fetchUrl).not.toHaveBeenCalled();
    expect(
      document.querySelector('[aria-label="Package camera loading"]'),
    ).not.toBeNull();

    await rerender(true);
    expect(fetchUrl).toHaveBeenCalledTimes(1);
  });

  it('refreshes with the token current at each fetch', async () => {
    const { mock, fetchUrl, advance } = await setup();
    await advance(0);
    expect(text()).toContain('Doorstep · Still');

    mock.controls.setState(PACKAGE, 'idle', { access_token: 'two' });
    await advance(PACKAGE_REFRESH_MS);

    expect(fetchUrl.mock.calls.map(([url]) => url)).toEqual([
      `/api/camera_proxy/${PACKAGE}?token=one&width=480&height=360`,
      `/api/camera_proxy/${PACKAGE}?token=two&width=480&height=360`,
    ]);
  });

  it('shows when the still was taken once it is old', async () => {
    const { fetchUrl, advance } = await setup();
    await advance(0);
    fetchUrl.mockImplementation(() => new Promise<string>(() => {}));

    await advance(PACKAGE_STALE_MS);
    expect(text()).not.toContain('Updated');
    await advance(PACKAGE_REFRESH_MS);

    expect(text()).toContain('Updated');
  });

  it('shows unavailable when the entity is, and recovers', async () => {
    const { mock, fetchUrl, advance } = await setup();
    mock.controls.setUnavailable(PACKAGE);
    await advance(PACKAGE_REFRESH_MS);

    expect(text()).toContain('Package camera unavailable');
    expect(document.querySelector('button')).toBeNull();

    mock.controls.setState(PACKAGE, 'idle', { access_token: 'three' });
    await advance(PACKAGE_REFRESH_MS);
    expect(fetchUrl).toHaveBeenCalledTimes(2);
    expect(text()).toContain('Doorstep · Still');
  });

  it('shows unavailable when a fetch fails', async () => {
    const { fetchUrl, advance } = await setup();
    fetchUrl.mockRejectedValue(new Error('HTTP 500'));
    await advance(PACKAGE_REFRESH_MS);

    expect(text()).toContain('Package camera unavailable');
  });

  it('aborts the fetch in flight when it unmounts', async () => {
    const { fetchUrl, rerender } = await setup(false);
    let signal: AbortSignal | undefined;
    fetchUrl.mockImplementation((_url: string, s?: AbortSignal) => {
      signal = s;
      return new Promise<string>(() => {});
    });
    await rerender(true);

    await act(() => render(null, document.body));

    expect(signal?.aborted).toBe(true);
  });
});

// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { describe, expect, it, vi } from 'vitest';

import { HaConnection } from '@/components/layout/ha-connection.tsx';
import { config } from '@/config/config.ts';
import { createMockHa } from '@/dev/mock/engine.ts';
import { createHaStore } from '@/services/ha/store.ts';

import { ToggleTile } from './toggle-tile.tsx';

const id = config.entities.light.id;

const setup = async () => {
  const mock = createMockHa();
  const store = createHaStore(mock.deps);
  await act(async () => {
    await store.start(mock.getAuth);
    render(
      <HaConnection store={store}>
        <ToggleTile
          entity="light"
          label="Office light"
          area="light"
          store={store}
        />
      </HaConnection>,
      document.body,
    );
  });
  const button = () => document.querySelector('button')!;
  return { mock, store, button };
};

describe('ToggleTile', () => {
  it('shows the light state', async () => {
    const { button } = await setup();

    expect(button().textContent).toContain('Off');
    expect(button().getAttribute('aria-pressed')).toBe('false');
  });

  it('toggles the real entity on tap', async () => {
    const { mock, button } = await setup();

    await act(async () => button().click());
    expect(mock.controls.getState(id)?.state).toBe('on');
    expect(button().textContent).toContain('On');

    await act(async () => button().click());
    expect(mock.controls.getState(id)?.state).toBe('off');
  });

  it('follows changes made elsewhere', async () => {
    const { mock, button } = await setup();

    await act(() => mock.controls.setState(id, 'on'));
    expect(button().textContent).toContain('On');
    expect(button().getAttribute('aria-pressed')).toBe('true');
  });

  it('is disabled while the light is unavailable', async () => {
    const { mock, button } = await setup();

    await act(() => mock.controls.setUnavailable(id));
    expect(button().disabled).toBe(true);
    expect(button().textContent).toContain('Unavailable');
  });

  it('is stale and disabled while HA is disconnected, then recovers', async () => {
    const { mock, button } = await setup();

    await act(() => mock.controls.setConnected(false));
    expect(button().disabled).toBe(true);
    expect(button().textContent).toContain('stale');
    expect(button().textContent).toContain('Off');

    await act(() => mock.controls.setConnected(true));
    expect(button().disabled).toBe(false);
    expect(button().textContent).not.toContain('stale');
  });

  it('flips at once, before HA confirms', async () => {
    const { mock, store, button } = await setup();
    let resolve!: () => void;
    vi.spyOn(store, 'callService').mockReturnValue(
      new Promise<undefined>((r) => (resolve = () => r(undefined))) as never,
    );

    await act(async () => button().click());
    expect(button().textContent).toContain('On');
    expect(button().getAttribute('aria-pressed')).toBe('true');
    expect(mock.controls.getState(id)?.state).toBe('off');

    await act(async () => resolve());
    expect(button().textContent).toContain('On');
  });

  it('reverts and flashes the tile when the call fails', async () => {
    vi.useFakeTimers();
    const { mock, button } = await setup();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    mock.controls.failServices(true);

    await act(async () => button().click());
    expect(button().textContent).toContain('Off');
    expect(button().getAttribute('aria-pressed')).toBe('false');
    expect(button().className).toContain('bg-warn-soft');
    expect(error).toHaveBeenCalledWith(
      'Toggle Office light failed',
      expect.any(Error),
    );

    await act(async () => void vi.advanceTimersByTime(1000));
    expect(button().className).not.toContain('bg-warn-soft');

    mock.controls.failServices(false);
    await act(async () => button().click());
    expect(button().textContent).toContain('On');
    error.mockRestore();
    vi.useRealTimers();
  });

  it('flashes when the store cannot call HA', async () => {
    const { store, button } = await setup();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    store.stop();

    await act(async () => button().click());
    expect(button().className).toContain('bg-warn-soft');
    error.mockRestore();
  });
});

// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { describe, expect, it, vi } from 'vitest';

import { config } from '../config.ts';
import { ToggleTile } from './toggle-tile.tsx';
import { createMockHa } from '../ha/mock.ts';
import { createHaStore } from '../ha/store.ts';

const id = config.entities.officeLight.id;

const setup = async () => {
  const mock = createMockHa();
  const store = createHaStore(mock.deps);
  await act(async () => {
    await store.start(mock.getAuth);
    render(
      <ToggleTile entity="officeLight" label="Office" store={store} />,
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

  it('logs a failed toggle instead of throwing', async () => {
    const { store, button } = await setup();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    store.stop();

    await act(async () => button().click());
    expect(error).toHaveBeenCalledWith(
      'Toggle Office failed',
      expect.any(Error),
    );
    error.mockRestore();
  });
});

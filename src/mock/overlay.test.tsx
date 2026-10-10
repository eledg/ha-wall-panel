// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { config } from '../config.ts';
import { createMockHa } from './engine.ts';
import { Overlay } from './overlay.tsx';
import { createHaStore } from '../ha/store.ts';

afterEach(() => render(null, document.body));

const setup = async () => {
  const mock = createMockHa();
  const store = createHaStore(mock.deps);
  await act(async () => {
    await store.start(mock.getAuth);
    render(<Overlay mock={mock.controls} />, document.body);
  });
  const press = (label: string) =>
    act(() => {
      [...document.querySelectorAll('button')]
        .find((b) => b.textContent === label)!
        .click();
    });
  return { mock, store, press };
};

describe('Overlay', () => {
  it('is closed until the Mock button is pressed', async () => {
    const { press } = await setup();
    expect(document.querySelector('aside')).toBeNull();

    await press('Mock');
    expect(document.querySelector('aside')).not.toBeNull();
  });

  it('closes on a press outside, or Escape', async () => {
    const { press } = await setup();
    await press('Mock');
    const aside = document.querySelector('aside')!;

    await act(() => {
      aside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    expect(document.querySelector('aside')).not.toBeNull();

    await act(() => {
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    expect(document.querySelector('aside')).toBeNull();

    await press('Mock');
    await act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(document.querySelector('aside')).toBeNull();
  });

  it('groups controls under one heading per tile', async () => {
    const { press } = await setup();
    await press('Mock');
    const headings = [...document.querySelectorAll('h2')].map(
      (h) => h.textContent,
    );
    expect(headings).toEqual([
      'Home Assistant',
      'Weather',
      'Calendar',
      'Light',
    ]);
  });

  it('switches weather, entity and connection state', async () => {
    const { store, press } = await setup();
    const id = config.entities.weather.id;
    await press('Mock');

    await press('Snow');
    expect(store.getSnapshot().entities.weather?.state).toBe('snowy');
    expect(document.body.textContent).toContain(`${id}: snowy`);

    await press('Missing');
    expect(document.body.textContent).toContain(`${id}: missing`);
    await press('Restore');
    expect(store.getSnapshot().entities.weather?.state).toBe('snowy');

    await press('Unavailable');
    expect(store.getSnapshot().entities.weather?.state).toBe('unavailable');

    await press('Disconnected');
    expect(store.getSnapshot().status).toBe('disconnected');
    await press('Connected');
    expect(store.getSnapshot().status).toBe('connected');
  });

  it('drives the light from the same overlay', async () => {
    const { mock, press } = await setup();
    const light = config.entities.officeLight.id;
    await press('Mock');

    await press('HA flips light');
    expect(mock.controls.getState(light)?.state).toBe('on');
    await press('Light unavailable');
    expect(mock.controls.getState(light)?.state).toBe('unavailable');
    await press('Light back');
    expect(mock.controls.getState(light)?.state).toBe('off');
  });

  it('makes the forecast fetch fail', async () => {
    const { store, press } = await setup();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await press('Mock');

    await press('Fails');
    await press('Rain');

    await vi.waitFor(() => expect(error).toHaveBeenCalled());
    expect(store.getSnapshot().entities.weather?.state).toBe('rainy');
    error.mockRestore();
  });
});

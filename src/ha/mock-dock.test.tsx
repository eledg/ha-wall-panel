// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { config } from '../config.ts';
import { MockDock } from './mock-dock.tsx';
import { createMockHa } from './mock.ts';
import { createHaStore } from './store.ts';

afterEach(() => render(null, document.body));

const setup = async () => {
  const mock = createMockHa();
  const store = createHaStore(mock.deps);
  await act(async () => {
    await store.start(mock.getAuth);
    render(<MockDock mock={mock.controls} store={store} />, document.body);
  });
  const press = (label: string) =>
    act(() => {
      [...document.querySelectorAll('button')]
        .find((b) => b.textContent === label)!
        .click();
    });
  return { mock, store, press };
};

describe('MockDock', () => {
  it('is closed until the Mock button is pressed', async () => {
    const { press } = await setup();
    expect(document.querySelector('aside')).toBeNull();

    await press('Mock');
    expect(document.querySelector('aside')).not.toBeNull();
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

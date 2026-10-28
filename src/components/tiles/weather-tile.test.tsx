// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it } from 'vitest';

import { HaConnection } from '@/components/layout/ha-connection.tsx';
import { createMockHa } from '@/dev/mock/engine.ts';
import { createHaStore } from '@/services/ha/store.ts';
import { entityId, tileOf } from '@/tests/ids.ts';

import { WeatherTile } from './weather-tile.tsx';

const id = entityId('weather');
const text = () => document.body.textContent;

afterEach(() => render(null, document.body));

const setup = async () => {
  const mock = createMockHa();
  const store = createHaStore(mock.deps);
  await act(async () => {
    await store.start(mock.getAuth);
    render(
      <WeatherTile tile={tileOf('weather')} store={store} />,
      document.body,
    );
  });
  return { mock, store };
};

describe('WeatherTile', () => {
  it('shows current conditions and the forecast', async () => {
    await setup();

    expect(text()).toContain('11°');
    expect(text()).toContain('Sunny');
    expect(text()).toMatch(/\d+%/);
  });

  it('shows the UV index instead of the rain chance when metric is uv', async () => {
    const mock = createMockHa();
    const store = createHaStore(mock.deps);
    await act(async () => {
      await store.start(mock.getAuth);
      render(
        <WeatherTile
          tile={{ ...tileOf('weather'), metric: 'uv' }}
          store={store}
        />,
        document.body,
      );
    });

    expect(text()).toContain('Sunny');
    expect(text()).not.toMatch(/\d+%/);
  });

  it('follows the entity', async () => {
    const { mock } = await setup();

    await act(async () =>
      mock.controls.setState(id, 'rainy', { temperature: 7 }),
    );

    expect(text()).toContain('7°');
    expect(text()).toContain('Rain');
  });

  it('handles an unavailable entity', async () => {
    const { mock } = await setup();

    await act(async () => mock.controls.setUnavailable(id));

    expect(text()).toContain('Weather unavailable');
  });

  it('renders the last known state, marked stale, once offline', async () => {
    const { store } = await setup();
    const { entities, forecasts } = store.getSnapshot();
    expect(entities[entityId('weather')]).toBeDefined();
    expect(forecasts[entityId('weather')]).toBeDefined();

    const offline = { ...store.getSnapshot(), status: 'disconnected' as const };
    await act(async () => {
      render(
        <HaConnection store={{ ...store, getSnapshot: () => offline }}>
          <WeatherTile
            tile={tileOf('weather')}
            store={{ ...store, getSnapshot: () => offline }}
          />
        </HaConnection>,
        document.body,
      );
    });

    expect(text()).toContain('11°');
    expect(text()).toContain('stale');
  });

  it('opens the weather sheet when tapped, and closes it again', async () => {
    await setup();
    expect(document.querySelector('dialog')).toBeNull();

    await act(() =>
      document.querySelector<HTMLButtonElement>('button')!.click(),
    );
    expect(document.querySelector('dialog')).not.toBeNull();
    expect(text()).toContain('Feels like');

    await act(() =>
      document
        .querySelector<HTMLButtonElement>('[aria-label="Close"]')!
        .click(),
    );
    expect(document.querySelector('dialog')).toBeNull();
  });

  it('is not tappable while unavailable', async () => {
    const { mock } = await setup();

    await act(async () => mock.controls.setUnavailable(id));

    expect(document.querySelector('button')).toBeNull();
  });

  it('shows a skeleton before the first state arrives', async () => {
    const store = createHaStore(createMockHa().deps);
    await act(async () =>
      render(
        <WeatherTile tile={tileOf('weather')} store={store} />,
        document.body,
      ),
    );

    expect(text()).not.toContain('unavailable');
    expect(document.querySelector('.bg-surface-2')).not.toBeNull();
  });
});

// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it } from 'vitest';

import { config } from '../config.ts';
import { pickForecast, WeatherTile } from './weather-tile.tsx';
import { HaConnection } from '../ha/connection.tsx';
import { createHaStore } from '../ha/store.ts';
import { createMockHa } from '../mock/engine.ts';

const id = config.entities.weather.id;
const text = () => document.body.textContent;

afterEach(() => render(null, document.body));

const setup = async () => {
  const mock = createMockHa();
  const store = createHaStore(mock.deps);
  await act(async () => {
    await store.start(mock.getAuth);
    render(<WeatherTile area="weather" store={store} />, document.body);
  });
  return { mock, store };
};

describe('pickForecast', () => {
  it('takes every third future hour, up to five', () => {
    const now = new Date('2026-01-05T09:30:00Z');
    const items = Array.from({ length: 24 }, (_, i) => ({
      datetime: new Date(now.getTime() + (i + 1) * 3_600_000).toISOString(),
      temperature: i,
    }));
    expect(pickForecast(items, now).map((item) => item.temperature)).toEqual([
      2, 5, 8, 11, 14,
    ]);
  });

  it('returns what exists when the forecast is short', () => {
    expect(pickForecast([], new Date())).toEqual([]);
  });
});

describe('WeatherTile', () => {
  it('shows current conditions and the forecast', async () => {
    await setup();

    expect(text()).toContain('11°');
    expect(text()).toContain('Sunny');
    expect(text()).toMatch(/\d+%/);
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
    expect(entities.weather).toBeDefined();
    expect(forecasts.weather).toBeDefined();

    const offline = { ...store.getSnapshot(), status: 'disconnected' as const };
    await act(async () => {
      render(
        <HaConnection store={{ ...store, getSnapshot: () => offline }}>
          <WeatherTile
            area="weather"
            store={{ ...store, getSnapshot: () => offline }}
          />
        </HaConnection>,
        document.body,
      );
    });

    expect(text()).toContain('11°');
    expect(text()).toContain('stale');
  });

  it('shows a skeleton before the first state arrives', async () => {
    const store = createHaStore(createMockHa().deps);
    await act(async () =>
      render(<WeatherTile area="weather" store={store} />, document.body),
    );

    expect(text()).not.toContain('unavailable');
    expect(document.querySelector('.bg-surface-2')).not.toBeNull();
  });
});

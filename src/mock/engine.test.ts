import type { HassEntities } from 'home-assistant-js-websocket';
import { describe, expect, it, vi } from 'vitest';

import { config } from '../config.ts';
import { createMockHa, UNRELATED_ID } from './engine.ts';
import { createHaStore } from '../ha/store.ts';

const LIGHT = config.entities.officeLight.id;
const LUX = config.entities.officeIlluminance.id;
const WEATHER = config.entities.weather.id;

const connect = async () => {
  const mock = createMockHa();
  const conn = await mock.deps.createConnection({});
  const seen: HassEntities[] = [];
  mock.deps.subscribeEntities(conn, (all) => seen.push(all));
  const call = (service: string, domain = 'switch', entity = LIGHT) =>
    mock.deps.callService(conn, domain, service, undefined, {
      entity_id: entity,
    });
  return { mock, seen, call, latest: () => seen.at(-1)! };
};

describe('createMockHa', () => {
  it('delivers every entity on subscribe, including an unrelated one', async () => {
    const { latest } = await connect();

    expect(Object.keys(latest()).sort()).toEqual(
      [LIGHT, LUX, WEATHER, UNRELATED_ID].sort(),
    );
    expect(latest()[LIGHT]?.state).toBe('off');
  });

  it('applies switch services to the fake state', async () => {
    const { call, latest } = await connect();

    await call('toggle');
    expect(latest()[LIGHT]?.state).toBe('on');
    await call('turn_off');
    expect(latest()[LIGHT]?.state).toBe('off');
    await call('turn_on');
    expect(latest()[LIGHT]?.state).toBe('on');
  });

  it('gives a changed entity a new object and leaves the rest alone', async () => {
    const { call, seen } = await connect();
    const before = seen.at(-1)!;

    await call('toggle');

    const after = seen.at(-1)!;
    expect(after[LIGHT]).not.toBe(before[LIGHT]);
    expect(after[LUX]).toBe(before[LUX]);
  });

  it('rejects unknown services and entities', async () => {
    const { call } = await connect();

    await expect(call('explode')).rejects.toThrow('no service');
    await expect(call('toggle', 'light')).rejects.toThrow('no service');
    await expect(call('toggle', 'switch', 'switch.nope')).rejects.toThrow(
      'unknown',
    );
  });

  it('marks an entity unavailable and sets state as if HA had', async () => {
    const { mock, latest } = await connect();

    mock.controls.setUnavailable(LIGHT);
    expect(latest()[LIGHT]?.state).toBe('unavailable');

    mock.controls.setState(LUX, '55');
    expect(latest()[LUX]).toMatchObject({
      state: '55',
      attributes: { unit_of_measurement: 'lx' },
    });
  });

  it('needs no credentials', async () => {
    await expect(createMockHa().getAuth()).resolves.toEqual({});
  });
});

describe('store against the mock', () => {
  it('tracks only configured entities and follows changes', async () => {
    const mock = createMockHa();
    const store = createHaStore(mock.deps);

    await store.start(mock.getAuth);

    const { status, entities } = store.getSnapshot();
    expect(status).toBe('connected');
    expect(Object.keys(entities).sort()).toEqual([
      'officeIlluminance',
      'officeLight',
      'weather',
    ]);

    await store.callService('officeLight', 'toggle');
    expect(store.getSnapshot().entities.officeLight?.state).toBe('on');

    mock.controls.setUnavailable(LIGHT);
    expect(store.getSnapshot().entities.officeLight?.state).toBe('unavailable');
  });
});

describe('mock weather controls', () => {
  const setup = async () => {
    const mock = createMockHa();
    const store = createHaStore(mock.deps);
    await store.start(mock.getAuth);
    return { mock, store };
  };

  it('switches scenario: state, attributes and forecast follow', async () => {
    const { mock, store } = await setup();

    mock.controls.setWeather('snowy');

    await vi.waitFor(() =>
      expect(store.getSnapshot().forecasts.weather?.[2]?.condition).toBe(
        'snowy',
      ),
    );
    expect(store.getSnapshot().entities.weather).toMatchObject({
      state: 'snowy',
      attributes: { temperature: -1 },
    });
  });

  it('drops the old forecast when the entity has no hourly support', async () => {
    const { mock, store } = await setup();
    await vi.waitFor(() =>
      expect(store.getSnapshot().forecasts.weather).toBeDefined(),
    );

    mock.controls.setWeather('no-forecast');

    await vi.waitFor(() =>
      expect(store.getSnapshot().forecasts.weather).toBeUndefined(),
    );
  });

  it('removes an entity and refuses forecasts for it', async () => {
    const { mock, store } = await setup();

    mock.controls.removeEntity(WEATHER);

    expect(store.getSnapshot().entities.weather).toBeUndefined();
    await expect(
      mock.deps.callService(
        {} as never,
        'weather',
        'get_forecasts',
        { type: 'hourly' },
        { entity_id: WEATHER },
        true,
      ),
    ).rejects.toThrow('unknown');
  });

  it('drives the connection status', async () => {
    const { mock, store } = await setup();

    mock.controls.setConnected(false);
    expect(store.getSnapshot().status).toBe('disconnected');

    mock.controls.setConnected(true);
    expect(store.getSnapshot().status).toBe('connected');
  });

  it('keeps the last forecast when fetches fail', async () => {
    const { mock, store } = await setup();
    await vi.waitFor(() =>
      expect(store.getSnapshot().forecasts.weather).toBeDefined(),
    );
    const before = store.getSnapshot().forecasts.weather;
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    mock.controls.failForecast(true);
    mock.controls.setWeather('rainy');

    await vi.waitFor(() => expect(error).toHaveBeenCalled());
    expect(store.getSnapshot().forecasts.weather).toBe(before);
    error.mockRestore();
  });
});

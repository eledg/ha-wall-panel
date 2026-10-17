import type { HassEntities } from 'home-assistant-js-websocket';
import { describe, expect, it, vi } from 'vitest';

import { config } from '../config.ts';
import { createMockHa, UNRELATED_ID } from './engine.ts';
import { createHaStore } from '../ha/store.ts';

const LIGHT = config.entities.officeLight.id;
const WEATHER = config.entities.weather.id;
const AC = config.entities.acClimate.id;
const AC_SWITCHES = [
  config.entities.acPowerful.id,
  config.entities.acEconomy.id,
  config.entities.acQuietFan.id,
];
const CALENDARS = [
  config.entities.calendarFamily,
  config.entities.calendarF1,
  config.entities.calendarBirthdays,
];

const connect = async () => {
  const mock = createMockHa();
  const conn = await mock.deps.createConnection({});
  const seen: HassEntities[] = [];
  mock.deps.subscribeEntities(conn, (all) => seen.push(all));
  const call = (
    service: string,
    domain = 'switch',
    entity = LIGHT,
    data?: object,
  ) =>
    mock.deps.callService(conn, domain, service, data, {
      entity_id: entity,
    });
  return { mock, seen, call, latest: () => seen.at(-1)! };
};

describe('createMockHa', () => {
  it('delivers every entity on subscribe, including an unrelated one', async () => {
    const { latest } = await connect();

    expect(Object.keys(latest()).sort()).toEqual(
      [
        LIGHT,
        WEATHER,
        AC,
        ...AC_SWITCHES,
        config.entities.officeTemperature.id,
        config.entities.officeHumidity.id,
        config.entities.officeBattery.id,
        ...CALENDARS.map(({ id }) => id),
        UNRELATED_ID,
      ].sort(),
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
    expect(after[WEATHER]).toBe(before[WEATHER]);
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

    mock.controls.setState(WEATHER, 'rainy', { temperature: 9 });
    expect(latest()[WEATHER]).toMatchObject({
      state: 'rainy',
      attributes: { temperature: 9 },
    });
  });

  it('needs no credentials', async () => {
    await expect(createMockHa().getAuth()).resolves.toEqual({});
  });
});

describe('the mock AC', () => {
  const ac = (service: string, data?: object) =>
    connect().then(({ mock, call, latest }) => ({
      mock,
      latest,
      run: (s = service, d = data) => call(s, 'climate', AC, d),
    }));

  it('starts off with the real entity attributes', async () => {
    const { latest } = await ac('turn_on');

    expect(latest()[AC]?.state).toBe('off');
    expect(latest()[AC]?.attributes).toMatchObject({
      hvac_modes: ['off', 'cool', 'heat', 'fan_only', 'dry', 'auto'],
      temperature: 24,
      min_temp: 16,
      max_temp: 30,
      target_temp_step: 0.5,
    });
  });

  it('turns on to the last mode used, and off again', async () => {
    const { run, latest } = await ac('turn_on');

    await run('turn_on');
    expect(latest()[AC]?.state).toBe('cool');
    await run('set_hvac_mode', { hvac_mode: 'heat' });
    await run('turn_off');
    expect(latest()[AC]?.state).toBe('off');
    await run('turn_on');
    expect(latest()[AC]?.state).toBe('heat');
  });

  it('sets the target, fan and swing, keeping the rest', async () => {
    const { run, latest } = await ac('turn_on');

    await run('set_temperature', { temperature: 21.5 });
    await run('set_fan_mode', { fan_mode: 'Quiet' });
    await run('set_swing_mode', { swing_mode: 'Lowest' });

    expect(latest()[AC]?.attributes).toMatchObject({
      temperature: 21.5,
      fan_mode: 'Quiet',
      swing_mode: 'Lowest',
      hvac_modes: expect.any(Array),
    });
  });

  it('rejects values the entity does not offer', async () => {
    const { run } = await ac('turn_on');

    await expect(run('set_temperature', { temperature: 31 })).rejects.toThrow(
      'valid target',
    );
    await expect(run('set_temperature', { temperature: 21.3 })).rejects.toThrow(
      'valid target',
    );
    await expect(run('set_hvac_mode', { hvac_mode: 'turbo' })).rejects.toThrow(
      'hvac_mode',
    );
    await expect(run('set_fan_mode', { fan_mode: 'gale' })).rejects.toThrow(
      'fan_mode',
    );
    await expect(run('explode')).rejects.toThrow('no service climate.explode');
  });

  it('fails climate calls when services are set to fail', async () => {
    const { mock, run, latest } = await ac('turn_on');

    mock.controls.failServices(true);

    await expect(run('turn_on')).rejects.toThrow('service call failed');
    expect(latest()[AC]?.state).toBe('off');
  });

  it('toggles the AC switches like any switch', async () => {
    const { mock } = await ac('turn_on');
    const conn = await mock.deps.createConnection({});
    await mock.deps.callService(conn, 'switch', 'toggle', undefined, {
      entity_id: AC_SWITCHES[0],
    });

    expect(mock.controls.getState(AC_SWITCHES[0]!)?.state).toBe('on');
  });

  it('can show odd data and restore it', async () => {
    const { mock } = await ac('turn_on');

    mock.controls.setAcOdd(true);
    expect(mock.controls.getState(AC)?.attributes).not.toHaveProperty(
      'current_temperature',
    );
    mock.controls.setAcOdd(false);
    expect(mock.controls.getState(AC)?.attributes).toHaveProperty(
      'current_temperature',
    );
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
      'acClimate',
      'acEconomy',
      'acPowerful',
      'acQuietFan',
      'calendarBirthdays',
      'calendarF1',
      'calendarFamily',
      'officeBattery',
      'officeHumidity',
      'officeLight',
      'officeTemperature',
      'weather',
    ]);

    await store.callService('officeLight', 'toggle');
    expect(store.getSnapshot().entities.officeLight?.state).toBe('on');

    mock.controls.setUnavailable(LIGHT);
    expect(store.getSnapshot().entities.officeLight?.state).toBe('unavailable');
  });
});

describe('mock service failures', () => {
  it('rejects switch calls and leaves the state alone', async () => {
    const mock = createMockHa();
    const store = createHaStore(mock.deps);
    await store.start(mock.getAuth);
    mock.controls.failServices(true);

    await expect(store.callService('officeLight', 'toggle')).rejects.toThrow(
      'service call failed',
    );
    expect(store.getSnapshot().entities.officeLight?.state).toBe('off');

    mock.controls.failServices(false);
    await store.callService('officeLight', 'toggle');
    expect(store.getSnapshot().entities.officeLight?.state).toBe('on');
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
    expect(mock.controls.isConnected()).toBe(false);

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

  it('holds changes while disconnected and replays them on reconnect', async () => {
    const { mock, call, seen, latest } = await connect();
    mock.controls.setConnected(false);
    const before = seen.length;

    mock.controls.setState(LIGHT, 'on');
    await expect(call('toggle')).rejects.toThrow();

    expect(seen).toHaveLength(before);
    mock.controls.setConnected(true);
    expect(latest()[LIGHT]?.state).toBe('on');
  });
});

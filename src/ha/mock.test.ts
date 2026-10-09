import type { HassEntities } from 'home-assistant-js-websocket';
import { describe, expect, it } from 'vitest';

import { config } from '../config.ts';
import { createMockHa, UNRELATED_ID } from './mock.ts';
import { createHaStore } from './store.ts';

const LIGHT = config.entities.officeLight.id;
const LUX = config.entities.officeIlluminance.id;

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
      [LIGHT, LUX, UNRELATED_ID].sort(),
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
    ]);

    await store.callService('officeLight', 'toggle');
    expect(store.getSnapshot().entities.officeLight?.state).toBe('on');

    mock.controls.setUnavailable(LIGHT);
    expect(store.getSnapshot().entities.officeLight?.state).toBe('unavailable');
  });
});

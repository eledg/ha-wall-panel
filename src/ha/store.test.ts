import type {
  Auth,
  Connection,
  HassEntities,
} from 'home-assistant-js-websocket';
import { describe, expect, it, vi } from 'vitest';

import { config, placeholder } from '../config.ts';
import { createHaStore } from './store.ts';
import type { HaDeps } from './store.ts';

const settings = () => Promise.resolve({} as Auth);

const entity = (entity_id: string, state: string) =>
  ({ entity_id, state, attributes: {} }) as HassEntities[string];

const setup = () => {
  const listeners: Record<string, () => void> = {};
  const conn = {
    close: vi.fn(),
    addEventListener: (event: string, cb: () => void) => {
      listeners[event] = cb;
    },
  } as unknown as Connection;
  let push: (all: HassEntities) => void = () => {};
  const deps = {
    createConnection: vi.fn().mockResolvedValue(conn),
    subscribeEntities: vi.fn((_: Connection, cb: typeof push) => {
      push = cb;
      return vi.fn();
    }),
    callService: vi.fn().mockResolvedValue(undefined),
  };
  const store = createHaStore(deps as unknown as HaDeps);
  return {
    store,
    deps,
    conn,
    listeners,
    push: (all: HassEntities) => push(all),
  };
};

describe('createHaStore', () => {
  it('subscribes to exactly the configured entities', () => {
    const { store } = setup();

    expect(store.getSnapshot().subscribed).toEqual(
      Object.values(config.entities).map(({ id }) => id),
    );
  });

  it('omits entities that fail config validation', () => {
    const bad = {
      entities: {
        ...config.entities,
        officeLight: { domain: 'switch', id: placeholder('light') },
      },
    } as unknown as typeof config;

    const store = createHaStore(undefined, bad);

    expect(store.getSnapshot().subscribed).toEqual([
      config.entities.officeIlluminance.id,
    ]);
  });

  it('keeps only configured entities from the full state', async () => {
    const { store, push } = setup();
    await store.start(settings);

    push({
      [config.entities.officeLight.id]: entity('light', 'on'),
      'switch.unrelated': entity('other', 'on'),
    });

    expect(Object.keys(store.getSnapshot().entities)).toEqual(['officeLight']);
    expect(store.getSnapshot().entities.officeLight?.state).toBe('on');
  });

  it('notifies subscribers only when a tracked entity changes', async () => {
    const { store, push } = setup();
    await store.start(settings);
    const listener = vi.fn();
    store.subscribe(listener);
    const light = entity('light', 'on');

    push({ [config.entities.officeLight.id]: light });
    push({ [config.entities.officeLight.id]: light, 'switch.other': light });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('tracks connection status', async () => {
    const { store, listeners } = setup();
    await store.start(settings);
    expect(store.getSnapshot().status).toBe('connected');

    listeners.disconnected?.();
    expect(store.getSnapshot().status).toBe('disconnected');

    listeners.ready?.();
    expect(store.getSnapshot().status).toBe('connected');
  });

  it('reports a rejected token', async () => {
    const { store, deps } = setup();
    deps.createConnection.mockRejectedValue(2);

    await store.start(settings);

    expect(store.getSnapshot()).toMatchObject({
      status: 'error',
      error: 'Home Assistant rejected the login',
      rejected: true,
    });
  });

  it('calls a service on the configured entity', async () => {
    const { store, deps, conn } = setup();
    await store.start(settings);

    await store.callService('officeLight', 'toggle');

    expect(deps.callService).toHaveBeenCalledWith(
      conn,
      'switch',
      'toggle',
      undefined,
      { entity_id: config.entities.officeLight.id },
    );
  });

  it('rejects a service call while not connected', async () => {
    const { store, deps } = setup();

    await expect(store.callService('officeLight', 'toggle')).rejects.toThrow();
    expect(deps.callService).not.toHaveBeenCalled();
  });

  it('closes the connection on stop and ignores a superseded connect', async () => {
    const { store, conn } = setup();
    await store.start(settings);

    store.stop();

    expect(conn.close).toHaveBeenCalled();
    expect(store.getSnapshot()).toMatchObject({ status: 'idle', entities: {} });
  });
});

import type {
  Auth,
  Connection,
  HassEntities,
} from 'home-assistant-js-websocket';
import { describe, expect, it, vi } from 'vitest';

import {
  entityRefs,
  getConfig,
  placeholder,
  type RuntimeConfig,
} from '@/config/config.ts';
import { entityId } from '@/tests/ids.ts';

import { CALENDAR_REFRESH_MS } from './calendar.ts';
import { createHaStore, FORECAST_REFRESH_MS, retryDelay } from './store.ts';
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
    callService: vi.fn().mockResolvedValue({ response: {} }),
    fetchCalendarEvents: vi.fn().mockResolvedValue([]),
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

    expect(store.getSnapshot().subscribed).toEqual([
      ...new Set(entityRefs().map(({ id }) => id)),
    ]);
  });

  it('omits entities that fail config validation', () => {
    const bad: RuntimeConfig = {
      ...getConfig(),
      tiles: getConfig().tiles.map((tile) =>
        tile.type === 'toggle'
          ? { ...tile, entities: { entity: placeholder('light') } }
          : tile,
      ),
    };

    const store = createHaStore(undefined, bad);

    expect(store.getSnapshot().subscribed).toEqual(
      [...new Set(entityRefs().map(({ id }) => id))].filter(
        (id) => id !== entityId('light'),
      ),
    );
  });

  it('keeps only configured entities from the full state', async () => {
    const { store, push } = setup();
    await store.start(settings);

    push({
      [entityId('light')]: entity('light', 'on'),
      'switch.unrelated': entity('other', 'on'),
    });

    expect(Object.keys(store.getSnapshot().entities)).toEqual([
      entityId('light'),
    ]);
    expect(store.getSnapshot().entities[entityId('light')]?.state).toBe('on');
  });

  it('notifies subscribers only when a tracked entity changes', async () => {
    const { store, push } = setup();
    await store.start(settings);
    const listener = vi.fn();
    store.subscribe(listener);
    const light = entity('light', 'on');

    push({ [entityId('light')]: light });
    push({ [entityId('light')]: light, 'switch.other': light });

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

  it('retries the first connect with backoff until HA answers', async () => {
    vi.useFakeTimers();
    try {
      const { store, deps, conn } = setup();
      deps.createConnection
        .mockRejectedValueOnce(1)
        .mockRejectedValueOnce(1)
        .mockResolvedValue(conn);

      const started = store.start(settings);
      await vi.advanceTimersByTimeAsync(0);
      expect(store.getSnapshot()).toMatchObject({
        status: 'error',
        error: 'Cannot reach Home Assistant',
      });

      await vi.advanceTimersByTimeAsync(retryDelay(0));
      expect(deps.createConnection).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(retryDelay(1));
      await started;

      expect(deps.createConnection).toHaveBeenCalledTimes(3);
      expect(store.getSnapshot()).toMatchObject({
        status: 'connected',
        error: undefined,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('caps the retry delay', () => {
    expect([0, 1, 2, 3, 10].map(retryDelay)).toEqual([
      1000, 2000, 4000, 5000, 5000,
    ]);
  });

  it('does not retry a rejected login', async () => {
    const { store, deps } = setup();
    deps.createConnection.mockRejectedValue(2);

    await store.start(settings);

    expect(deps.createConnection).toHaveBeenCalledTimes(1);
  });

  it('stops retrying after stop()', async () => {
    vi.useFakeTimers();
    try {
      const { store, deps } = setup();
      deps.createConnection.mockRejectedValue(1);
      const started = store.start(settings);
      await vi.advanceTimersByTimeAsync(0);

      store.stop();
      await started;
      await vi.advanceTimersByTimeAsync(60_000);

      expect(deps.createConnection).toHaveBeenCalledTimes(1);
      expect(store.getSnapshot().status).toBe('idle');
    } finally {
      vi.useRealTimers();
    }
  });

  it('records when data last arrived once the connection drops', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-03-14T09:41:00Z'));
      const { store, listeners, push } = setup();
      await store.start(settings);
      vi.setSystemTime(new Date('2026-03-14T09:45:00Z'));
      push({ [entityId('light')]: entity('light', 'on') });
      expect(store.getSnapshot().lastUpdate).toBeUndefined();

      vi.setSystemTime(new Date('2026-03-14T09:50:00Z'));
      listeners.disconnected!();
      expect(store.getSnapshot().lastUpdate).toBe(
        Date.parse('2026-03-14T09:45:00Z'),
      );

      listeners.ready!();
      expect(store.getSnapshot().lastUpdate).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports a refused reconnect as a rejected login', async () => {
    const { store, listeners } = setup();
    await store.start(settings);

    listeners['reconnect-error']!();

    expect(store.getSnapshot()).toMatchObject({
      status: 'error',
      rejected: true,
    });
  });

  it('calls a service on the configured entity', async () => {
    const { store, deps, conn } = setup();
    await store.start(settings);

    await store.callService('switch', entityId('light'), 'toggle');

    expect(deps.callService).toHaveBeenCalledWith(
      conn,
      'switch',
      'toggle',
      undefined,
      { entity_id: entityId('light') },
    );
  });

  it('rejects a service call while not connected', async () => {
    const { store, deps } = setup();

    await expect(
      store.callService('switch', entityId('light'), 'toggle'),
    ).rejects.toThrow();
    expect(deps.callService).not.toHaveBeenCalled();
  });

  it('closes the connection on stop and ignores a superseded connect', async () => {
    const { store, conn } = setup();
    await store.start(settings);

    store.stop();

    expect(conn.close).toHaveBeenCalled();
    expect(store.getSnapshot()).toMatchObject({ status: 'idle', entities: {} });
  });

  it('fetches the forecast when a weather entity changes and keeps it on failure', async () => {
    const { store, deps, push } = setup();
    const id = entityId('weather');
    const forecast = [{ datetime: '2026-01-05T10:00:00Z', temperature: 9 }];
    deps.callService.mockResolvedValueOnce({
      response: { [id]: { forecast } },
    });
    await store.start(settings);

    await vi.waitFor(() => {
      push({ [id]: entity(id, 'sunny') });
      expect(store.getSnapshot().forecasts[entityId('weather')]).toEqual(
        forecast,
      );
    });
    expect(deps.callService).toHaveBeenCalledWith(
      expect.anything(),
      'weather',
      'get_forecasts',
      { type: 'hourly' },
      { entity_id: id },
      true,
    );

    deps.callService.mockRejectedValueOnce(new Error('boom'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    push({ [id]: entity(id, 'rainy') });
    await vi.waitFor(() => expect(error).toHaveBeenCalled());
    expect(store.getSnapshot().forecasts[entityId('weather')]).toEqual(
      forecast,
    );
    error.mockRestore();
  });

  describe('forecast refresh', () => {
    const id = entityId('weather');
    const forecastCalls = (deps: ReturnType<typeof setup>['deps']) =>
      deps.callService.mock.calls.filter(
        ([, , service]) => service === 'get_forecasts',
      );
    const hourly = (features: number) => ({
      ...entity(id, 'sunny'),
      attributes: { supported_features: features },
    });

    it('refetches on a timer while connected, and stops on stop()', async () => {
      vi.useFakeTimers();
      try {
        const { store, deps } = setup();
        await store.start(settings);
        expect(forecastCalls(deps)).toHaveLength(0);

        await vi.advanceTimersByTimeAsync(FORECAST_REFRESH_MS);
        expect(forecastCalls(deps)).toHaveLength(1);

        store.stop();
        await vi.advanceTimersByTimeAsync(FORECAST_REFRESH_MS * 2);
        expect(forecastCalls(deps)).toHaveLength(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('refetches when the connection comes back', async () => {
      const { store, deps, listeners } = setup();
      await store.start(settings);

      listeners.ready!();

      await vi.waitFor(() => expect(forecastCalls(deps)).toHaveLength(1));
    });

    it('skips entities without hourly forecasts', async () => {
      const { store, deps, push } = setup();
      await store.start(settings);

      push({ [id]: hourly(1) as HassEntities[string] });
      expect(forecastCalls(deps)).toHaveLength(0);

      push({ [id]: hourly(3) as HassEntities[string] });
      expect(forecastCalls(deps)).toHaveLength(1);
    });
  });
});

describe('calendars', () => {
  const raw = [
    {
      summary: 'Dentist',
      start: { dateTime: '2026-10-10T10:00:00+01:00' },
      end: { dateTime: '2026-10-10T10:30:00+01:00' },
    },
  ];
  const calls = (deps: ReturnType<typeof setup>['deps']) =>
    deps.fetchCalendarEvents.mock.calls;

  it('fetches each calendar once connected, for a week from midnight', async () => {
    const { store, deps } = setup();
    deps.fetchCalendarEvents.mockResolvedValue(raw);

    await store.start(settings);

    await vi.waitFor(() =>
      expect(Object.keys(store.getSnapshot().calendars).sort()).toEqual(
        [
          entityId('calendarBirthdays'),
          entityId('calendarF1'),
          entityId('calendarFamily'),
        ].sort(),
      ),
    );
    expect(
      calls(deps)
        .map(([, id]) => id)
        .sort(),
    ).toEqual(
      [
        entityId('calendarBirthdays'),
        entityId('calendarF1'),
        entityId('calendarFamily'),
      ].sort(),
    );
    const [, , start, end] = calls(deps)[0]!;
    expect(start.getHours()).toBe(0);
    expect(end.getTime() - start.getTime()).toBeGreaterThanOrEqual(
      6.9 * 86_400_000,
    );
    expect(
      store.getSnapshot().calendars[entityId('calendarFamily')]?.[0]?.summary,
    ).toBe('Dentist');
  });

  it('refreshes on an interval and stops with the store', async () => {
    vi.useFakeTimers();
    try {
      const { store, deps } = setup();
      await store.start(settings);
      const initial = calls(deps).length;

      await vi.advanceTimersByTimeAsync(CALENDAR_REFRESH_MS);
      expect(calls(deps)).toHaveLength(initial * 2);

      store.stop();
      await vi.advanceTimersByTimeAsync(CALENDAR_REFRESH_MS * 2);
      expect(calls(deps)).toHaveLength(initial * 2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('refetches when a calendar entity changes', async () => {
    const { store, deps, push } = setup();
    await store.start(settings);
    const before = calls(deps).length;

    push({
      [entityId('calendarF1')]: entity(entityId('calendarF1'), 'on'),
    });

    expect(calls(deps)).toHaveLength(before + 1);
  });

  it('keeps the last events when a refresh fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { store, deps, listeners } = setup();
    deps.fetchCalendarEvents.mockResolvedValue(raw);
    await store.start(settings);
    await vi.waitFor(() =>
      expect(
        store.getSnapshot().calendars[entityId('calendarFamily')],
      ).toHaveLength(1),
    );

    deps.fetchCalendarEvents.mockRejectedValue(new Error('boom'));
    listeners.ready!();
    await vi.waitFor(() => expect(console.error).toHaveBeenCalled());

    expect(
      store.getSnapshot().calendars[entityId('calendarFamily')],
    ).toHaveLength(1);
    expect(store.getSnapshot().calendarFailed).toBe(false);
  });

  it('flags a calendar that has never loaded, and clears it on success', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { store, deps, listeners } = setup();
    deps.fetchCalendarEvents.mockRejectedValue(new Error('boom'));
    await store.start(settings);
    await vi.waitFor(() =>
      expect(store.getSnapshot().calendarFailed).toBe(true),
    );

    deps.fetchCalendarEvents.mockResolvedValue(raw);
    listeners.ready!();

    await vi.waitFor(() =>
      expect(store.getSnapshot().calendarFailed).toBe(false),
    );
  });

  it('records when each calendar last loaded', async () => {
    const { store, deps } = setup();
    deps.fetchCalendarEvents.mockResolvedValue(raw);
    const before = Date.now();

    await store.start(settings);

    await vi.waitFor(() =>
      expect(
        store.getSnapshot().calendarUpdated[entityId('calendarF1')],
      ).toBeDefined(),
    );
    expect(
      store.getSnapshot().calendarUpdated[entityId('calendarF1')],
    ).toBeGreaterThanOrEqual(before);
  });

  it('keeps the last load time when a refresh fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { store, deps, listeners } = setup();
    deps.fetchCalendarEvents.mockResolvedValue(raw);
    await store.start(settings);
    await vi.waitFor(() =>
      expect(
        store.getSnapshot().calendarUpdated[entityId('calendarF1')],
      ).toBeDefined(),
    );
    const loaded = store.getSnapshot().calendarUpdated[entityId('calendarF1')];

    deps.fetchCalendarEvents.mockRejectedValue(new Error('boom'));
    listeners.ready!();
    await vi.waitFor(() => expect(console.error).toHaveBeenCalled());

    expect(store.getSnapshot().calendarUpdated[entityId('calendarF1')]).toBe(
      loaded,
    );
  });

  it('drops calendars on stop', async () => {
    const { store, deps } = setup();
    deps.fetchCalendarEvents.mockResolvedValue(raw);
    await store.start(settings);
    await vi.waitFor(() =>
      expect(
        store.getSnapshot().calendars[entityId('calendarFamily')],
      ).toBeDefined(),
    );

    store.stop();

    expect(store.getSnapshot().calendars).toEqual({});
    expect(store.getSnapshot().calendarUpdated).toEqual({});
  });
});

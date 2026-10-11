import type { Auth, Connection, HassEntity } from 'home-assistant-js-websocket';

import { config } from '../config.ts';
import type { HaDeps } from '../ha/store.ts';
import { calendarScenarios } from './scenarios/calendar.ts';
import { forecastFor, weatherScenarios } from './scenarios/weather.ts';

/** Present only in mock code; a build test looks for it in `dist/`. */
export const MOCK_MARKER = 'wall-dashboard-mock-ha';

/** An entity that is not in the config, to prove the store filters. */
export const UNRELATED_ID = 'switch.mock_unrelated';

/**
 * What a test or the dev panel can do to the fake HA. Milestone 1 needs only
 * the light's on, off and unavailable states; later milestones add controls
 * here (failing calls, dropped connections, a doorbell ring) as they need them.
 */
export type MockControls = {
  getState: (id: string) => HassEntity | undefined;
  /** Changes an entity as if HA or a physical switch had. */
  setState: (
    id: string,
    state: string,
    attributes?: Record<string, unknown>,
  ) => void;
  setUnavailable: (id: string) => void;
  /** Drops an entity from HA entirely, as a wrong or deleted ID would. */
  removeEntity: (id: string) => void;
  /** Fires the connection's `disconnected` / `ready` events. */
  setConnected: (connected: boolean) => void;
  /** Whether the mock connection is currently up, as last set by `setConnected`. */
  isConnected: () => boolean;
  /** Makes `weather.get_forecasts` fail, to test the tile keeping its last forecast. */
  failForecast: (failing: boolean) => void;
  /** Whether forecast fetches are currently set to fail. */
  isForecastFailing: () => boolean;
  /** Makes switch service calls (the light toggle) fail, to test rollback. */
  failServices: (failing: boolean) => void;
  /** Whether switch service calls are currently set to fail. */
  isServicesFailing: () => boolean;
  /** Switches the weather entity (state, attributes and forecast) to a scenario. */
  setWeather: (scenarioId: string) => void;
  /** The id of the current weather scenario. */
  getWeatherScenario: () => string;
  /** Ids and labels only: the data stays in mock code, out of the production bundle. */
  weatherScenarios: { id: string; label: string }[];
  /** Switches every calendar's events to a scenario. */
  setCalendar: (scenarioId: string) => void;
  /** The id of the current calendar scenario. */
  getCalendarScenario: () => string;
  /** Makes calendar event fetches fail, to test the tile keeping its events. */
  failCalendar: (failing: boolean) => void;
  /** Whether calendar fetches are currently set to fail. */
  isCalendarFailing: () => boolean;
  /** Ids and labels only, as for weather. */
  calendarScenarios: { id: string; label: string }[];
  /** Calls `listener` after every change the mock makes; returns the unsubscribe. */
  subscribe: (listener: () => void) => () => void;
};

const SWITCH_SERVICES = ['turn_on', 'turn_off', 'toggle'];

export const createMockHa = (cfg: typeof config = config) => {
  const entities = new Map<string, HassEntity>();
  const subscribers = new Set<(all: Record<string, HassEntity>) => void>();
  let connected = true;
  const watchers = new Set<() => void>();
  const publish = () => {
    // While disconnected HA's updates don't arrive; they are replayed on reconnect.
    if (connected) {
      const all = Object.fromEntries(entities);
      subscribers.forEach((subscriber) => subscriber(all));
    }
    watchers.forEach((watcher) => watcher());
  };

  const make = (
    id: string,
    state: string,
    attributes: Record<string, unknown> = {},
  ): HassEntity => {
    const now = new Date().toISOString();
    return {
      entity_id: id,
      state,
      attributes,
      last_changed: now,
      last_updated: now,
      context: { id: MOCK_MARKER, parent_id: null, user_id: null },
    };
  };

  const light = cfg.entities.officeLight.id;
  entities.set(light, make(light, 'off'));
  const weather = cfg.entities.weather.id;
  const scenarios = weatherScenarios();
  let scenario = scenarios[0]!;
  entities.set(weather, make(weather, scenario.state, scenario.attributes));
  let calendarScenario = calendarScenarios[0]!;
  let calendarFails = false;
  const calendarKeys = [
    'calendarFamily',
    'calendarF1',
    'calendarBirthdays',
  ] as const;
  for (const key of calendarKeys) {
    entities.set(cfg.entities[key].id, make(cfg.entities[key].id, 'off'));
  }
  let forecastFails = false;
  let servicesFail = false;
  entities.set(UNRELATED_ID, make(UNRELATED_ID, 'off'));

  const setState: MockControls['setState'] = (id, state, attributes) => {
    // A new object per change, as the real library gives, so the store's
    // reference comparison sees it.
    entities.set(
      id,
      make(id, state, attributes ?? entities.get(id)?.attributes),
    );
    publish();
  };

  const listeners = new Map<string, Set<() => void>>();
  const connection = {
    addEventListener: (event: string, listener: () => void) => {
      listeners.set(event, (listeners.get(event) ?? new Set()).add(listener));
    },
    removeEventListener: (event: string, listener: () => void) =>
      void listeners.get(event)?.delete(listener),
    close: () => {},
  } as unknown as Connection;

  const deps = {
    createConnection: () => Promise.resolve(connection),
    subscribeEntities: (_conn, onChange) => {
      subscribers.add(onChange);
      onChange(Object.fromEntries(entities));
      return () => void subscribers.delete(onChange);
    },
    fetchCalendarEvents: (_auth, entityId) => {
      if (!connected) {
        return Promise.reject(new Error('Mock HA: connection lost'));
      }
      if (calendarFails) {
        return Promise.reject(new Error('Mock HA: calendar failed'));
      }
      const key = (
        Object.keys(cfg.entities) as (keyof typeof cfg.entities)[]
      ).find((k) => cfg.entities[k].id === entityId);
      if (!key || !entities.has(entityId)) {
        return Promise.reject(new Error(`Mock HA: unknown entity ${entityId}`));
      }
      return Promise.resolve(calendarScenario.events(new Date())[key] ?? []);
    },
    callService: (_conn, domain, service, _data, target) => {
      if (!connected) {
        return Promise.reject(new Error('Mock HA: connection lost'));
      }
      if (domain === 'weather' && service === 'get_forecasts') {
        const id = (target as { entity_id: string }).entity_id;
        if (!entities.has(id)) {
          return Promise.reject(new Error(`Mock HA: unknown entity ${id}`));
        }
        if (forecastFails) {
          return Promise.reject(new Error('Mock HA: forecast failed'));
        }
        const forecast = forecastFor(scenario, Date.now());
        return Promise.resolve({ response: { [id]: { forecast } } });
      }
      const id = (target as { entity_id?: string } | undefined)?.entity_id;
      const entity = id ? entities.get(id) : undefined;
      if (!id || !entity) {
        return Promise.reject(new Error(`Mock HA: unknown entity ${id}`));
      }
      if (domain !== 'switch' || !SWITCH_SERVICES.includes(service)) {
        return Promise.reject(
          new Error(`Mock HA: no service ${domain}.${service}`),
        );
      }
      if (servicesFail) {
        return Promise.reject(new Error('Mock HA: service call failed'));
      }
      const on =
        service === 'toggle' ? entity.state !== 'on' : service === 'turn_on';
      setState(id, on ? 'on' : 'off');
      return Promise.resolve();
    },
  } as HaDeps;

  const controls: MockControls = {
    getState: (id) => entities.get(id),
    setState,
    setUnavailable: (id) => setState(id, 'unavailable'),
    removeEntity: (id) => {
      entities.delete(id);
      publish();
    },
    setConnected: (value) => {
      connected = value;
      listeners.get(value ? 'ready' : 'disconnected')?.forEach((l) => l());
      // Like the library's resubscribe, bring subscribers up to date.
      publish();
    },
    isConnected: () => connected,
    failForecast: (failing) => {
      forecastFails = failing;
      watchers.forEach((watcher) => watcher());
    },
    isForecastFailing: () => forecastFails,
    failServices: (failing) => {
      servicesFail = failing;
      watchers.forEach((watcher) => watcher());
    },
    isServicesFailing: () => servicesFail,
    getWeatherScenario: () => scenario.id,
    setWeather: (id) => {
      scenario = scenarios.find((s) => s.id === id) ?? scenario;
      setState(weather, scenario.state, scenario.attributes);
    },
    getCalendarScenario: () => calendarScenario.id,
    setCalendar: (id) => {
      calendarScenario =
        calendarScenarios.find((s) => s.id === id) ?? calendarScenario;
      // As HA does when events change, touch the entities so the store refetches.
      for (const key of calendarKeys) {
        entities.set(cfg.entities[key].id, make(cfg.entities[key].id, 'off'));
      }
      publish();
    },
    failCalendar: (failing) => {
      calendarFails = failing;
      watchers.forEach((watcher) => watcher());
    },
    isCalendarFailing: () => calendarFails,
    calendarScenarios: calendarScenarios.map(({ id, label }) => ({
      id,
      label,
    })),
    weatherScenarios: scenarios.map(({ id, label }) => ({ id, label })),
    subscribe: (listener) => {
      watchers.add(listener);
      return () => void watchers.delete(listener);
    },
  };

  return {
    deps,
    controls,
    /** The mock needs no credentials. */
    getAuth: () => Promise.resolve({} as Auth),
  };
};

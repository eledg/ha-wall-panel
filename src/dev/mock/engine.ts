import type { Auth, Connection, HassEntity } from 'home-assistant-js-websocket';

import {
  type CalendarKind,
  type EntityDomain,
  entityRefs,
  firstTile,
  getConfig,
  type RuntimeConfig,
  type TileConfig,
  type TileType,
} from '@/config/config.ts';
import {
  AC_DEFAULT_MODE,
  acAttributes,
  acOddAttributes,
  applyClimateService,
} from '@/dev/mock/scenarios/ac.ts';
import { calendarScenarios } from '@/dev/mock/scenarios/calendar.ts';
import {
  applyHeatingService,
  BOOST_TARGET,
  demandHistory,
  heatingAttributes,
  heatingFixture,
  heatingStateOf,
  type MockHeatingState,
  SCHEDULED_TARGET,
} from '@/dev/mock/scenarios/heating.ts';
import { forecastFor, weatherScenarios } from '@/dev/mock/scenarios/weather.ts';
import type { HaDeps } from '@/services/ha/store.ts';

/** Present only in mock code; a build test looks for it in `dist/`. */
export const MOCK_MARKER = 'wall-panel-mock-ha';

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
  /** Makes switch and climate service calls (the light, the AC) fail, to test rollback. */
  failServices: (failing: boolean) => void;
  /** Whether switch and climate service calls are currently set to fail. */
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
  /** Gives the AC holes in its data and an option with no label (or restores it). */
  setAcOdd: (odd: boolean) => void;
  /** Whether the AC is showing odd data. */
  isAcOdd: () => boolean;
  /** Puts the heating in one of its four display states (power × control). */
  setHeating: (state: MockHeatingState) => void;
  /** The heating's current display state. */
  getHeating: () => MockHeatingState;
  /** Whether the boiler is called for heat (home-wide). */
  setHeatingDemand: (demand: boolean) => void;
  /** Sets the heating power in percent; demand is on above 0. */
  setHeatingPower: (percent: number) => void;
  /** Makes the demand history fetch fail. */
  failHistory: (failing: boolean) => void;
  /** Whether the demand history fetch is set to fail. */
  isHistoryFailing: () => boolean;
  /** Calls `listener` after every change the mock makes; returns the unsubscribe. */
  subscribe: (listener: () => void) => () => void;
};

const SWITCH_SERVICES = new Set(['turn_on', 'turn_off', 'toggle']);

/** The state of an entity the mock has no scenario for, by domain. */
const DEFAULT_STATE: Partial<Record<EntityDomain, string>> = {
  binary_sensor: 'on',
  button: 'unknown',
  sensor: '0',
};

const plainEntity = (
  domain: EntityDomain,
  scenario: { state: string; attributes: Record<string, unknown> },
) => {
  if (domain === 'weather') return scenario;
  if (domain === 'climate') return { state: 'off', attributes: acAttributes() };
  return { state: DEFAULT_STATE[domain] ?? 'off', attributes: {} };
};

export const createMockHa = (cfg: RuntimeConfig = getConfig()) => {
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

  /**
   * The mock's controls act on the first tile of each type; any further tiles
   * get a plain default state (below) and no scenarios.
   */
  const mockTile = <T extends TileType>(type: T): TileConfig<T> => {
    const tile = firstTile(type, cfg);
    if (!tile) throw new Error(`The mock needs a ${type} tile in its config`);
    return tile;
  };

  const light = mockTile('toggle').entities.entity;
  entities.set(light, make(light, 'off'));
  const weather = mockTile('weather').entities.entity;
  const scenarios = weatherScenarios();
  let scenario = scenarios[0]!;
  entities.set(weather, make(weather, scenario.state, scenario.attributes));
  let calendarScenario = calendarScenarios[0]!;
  let calendarFails = false;
  // The scenarios name their calendars by kind: the unmarked one is the family's.
  const calendarKinds = new Map<string, CalendarKind | undefined>();
  for (const tile of cfg.tiles) {
    if (tile.type !== 'calendar') continue;
    for (const { entity, kind } of tile.calendars)
      calendarKinds.set(entity, kind);
  }
  const SCENARIO_KEY = {
    f1: 'calendarF1',
    birthdays: 'calendarBirthdays',
  } as const;
  for (const id of calendarKinds.keys()) entities.set(id, make(id, 'off'));
  const ac = mockTile('ac').entities.climate;
  entities.set(ac, make(ac, 'off', acAttributes()));
  const room = mockTile('temperature').entities;
  const roomTemp = room.temperature;
  entities.set(roomTemp, make(roomTemp, '22.2', { unit_of_measurement: '°C' }));
  entities.set(
    room.humidity,
    make(room.humidity, '50.9', { unit_of_measurement: '%' }),
  );
  if (room.battery) {
    entities.set(
      room.battery,
      make(room.battery, '100', { unit_of_measurement: '%' }),
    );
  }
  const heatingEntities = mockTile('heating').entities;
  const heating = heatingEntities.climate;
  const heatingSchedule = heatingEntities.schedule;
  const heatingDemand = heatingEntities.demand;
  const heatingPower = heatingEntities.power!;
  const fixture = heatingFixture('schedule');
  entities.set(heating, make(heating, fixture.power, heatingAttributes()));
  entities.set(heatingSchedule, make(heatingSchedule, fixture.schedule));
  entities.set(heatingDemand, make(heatingDemand, 'on'));
  entities.set(
    heatingPower,
    make(heatingPower, '100', { unit_of_measurement: '%' }),
  );
  entities.set(heatingEntities.cloud, make(heatingEntities.cloud, 'on'));
  // Presses never change a button's state, as in HA.
  for (const id of [heatingEntities.resume, heatingEntities.boost]) {
    entities.set(id, make(id, 'unknown'));
  }
  // Every other entity (the first tile's switches, further tiles) starts plain.
  for (const { id, domain } of entityRefs(cfg)) {
    if (entities.has(id)) continue;
    const { state, attributes } = plainEntity(domain, scenario);
    entities.set(id, make(id, state, attributes));
  }
  let historyFails = false;
  // What `climate.turn_on` restores, as the real unit does.
  let acLastMode = AC_DEFAULT_MODE;
  let acOdd = false;
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

  /** Sets the heating power (percent) and, with it, the demand flag, as Tado does. */
  const setDemand = (percent: number) => {
    entities.set(
      heatingPower,
      make(heatingPower, String(percent), { unit_of_measurement: '%' }),
    );
    entities.set(
      heatingDemand,
      make(heatingDemand, percent > 0 ? 'on' : 'off'),
    );
  };

  /** Changes the heating's power, control and target together, with one update. */
  const setHeatingParts = (
    power: string,
    scheduleOn: boolean,
    target: unknown,
    demand?: boolean,
  ) => {
    const climate = entities.get(heating);
    entities.set(
      heating,
      make(heating, power, { ...climate?.attributes, temperature: target }),
    );
    entities.set(
      heatingSchedule,
      make(heatingSchedule, scheduleOn ? 'on' : 'off'),
    );
    if (demand !== undefined) setDemand(demand ? 100 : 0);
    publish();
  };

  const listeners = new Map<string, Set<() => void>>();
  const connection = {
    addEventListener: (event: string, listener: () => void) => {
      listeners.set(event, (listeners.get(event) ?? new Set()).add(listener));
    },
    removeEventListener: (event: string, listener: () => void) => {
      listeners.get(event)?.delete(listener);
    },
    close: () => {},
  } as unknown as Connection;

  const fail = (message: string) =>
    Promise.reject(new Error(`Mock HA: ${message}`));

  const getForecasts = (id: string) => {
    if (!entities.has(id)) return fail(`unknown entity ${id}`);
    if (forecastFails) return fail('forecast failed');
    const forecast = forecastFor(scenario, Date.now());
    return Promise.resolve({ response: { [id]: { forecast } } });
  };

  const pressButton = (id: string) => {
    if (servicesFail) return fail('service call failed');
    if (id === heatingEntities.resume) {
      setHeatingParts('heat', true, SCHEDULED_TARGET);
    } else if (id === heatingEntities.boost) {
      setHeatingParts('heat', false, BOOST_TARGET, true);
    }
    return Promise.resolve();
  };

  const callHeating = (
    entity: HassEntity,
    service: string,
    data: Record<string, unknown> | undefined,
  ) => {
    if (servicesFail) return fail('service call failed');
    if (entity.state === 'unavailable') return fail('heating unavailable');
    try {
      const next = applyHeatingService(
        entity.state,
        entity.attributes,
        entities.get(heatingSchedule)?.state === 'on',
        service,
        data,
      );
      // With no heating, nothing is calling for heat.
      setHeatingParts(
        next.power,
        next.scheduleOn,
        next.target,
        next.power === 'off' ? false : undefined,
      );
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err as Error);
    }
  };

  const callClimate = (
    id: string,
    entity: HassEntity,
    service: string,
    data: Record<string, unknown> | undefined,
  ) => {
    if (servicesFail) return fail('service call failed');
    try {
      const next = applyClimateService(
        entity.state,
        entity.attributes,
        service,
        acLastMode,
        data,
      );
      if (next.state !== 'off') acLastMode = next.state;
      setState(id, next.state, next.attributes);
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err as Error);
    }
  };

  const deps = {
    createConnection: () => Promise.resolve(connection),
    subscribeEntities: (_conn, onChange) => {
      subscribers.add(onChange);
      onChange(Object.fromEntries(entities));
      return () => {
        subscribers.delete(onChange);
      };
    },
    fetchCalendarEvents: (_auth, entityId) => {
      if (!connected) {
        return Promise.reject(new Error('Mock HA: connection lost'));
      }
      if (calendarFails) {
        return Promise.reject(new Error('Mock HA: calendar failed'));
      }
      if (!calendarKinds.has(entityId) || !entities.has(entityId)) {
        return Promise.reject(new Error(`Mock HA: unknown entity ${entityId}`));
      }
      const kind = calendarKinds.get(entityId);
      const key = kind ? SCENARIO_KEY[kind] : 'calendarFamily';
      return Promise.resolve(calendarScenario.events(new Date())[key] ?? []);
    },
    fetchHistory: (_auth, entityId) => {
      if (!connected) {
        return Promise.reject(new Error('Mock HA: connection lost'));
      }
      if (historyFails) {
        return Promise.reject(new Error('Mock HA: history failed'));
      }
      return Promise.resolve(
        entityId === heatingDemand ? demandHistory(Date.now()) : [],
      );
    },
    callService: (_conn, domain, service, data, target) => {
      if (!connected) return fail('connection lost');
      if (domain === 'weather' && service === 'get_forecasts') {
        return getForecasts((target as { entity_id: string }).entity_id);
      }
      const id = (target as { entity_id?: string } | undefined)?.entity_id;
      const entity = id ? entities.get(id) : undefined;
      if (!id || !entity) return fail(`unknown entity ${id}`);
      const input = data as Record<string, unknown> | undefined;
      if (domain === 'button' && service === 'press') return pressButton(id);
      if (domain === 'climate' && id === heating) {
        return callHeating(entity, service, input);
      }
      if (domain === 'climate') return callClimate(id, entity, service, input);
      if (domain !== 'switch' || !SWITCH_SERVICES.has(service)) {
        return fail(`no service ${domain}.${service}`);
      }
      if (servicesFail) return fail('service call failed');
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
    setAcOdd: (odd) => {
      acOdd = odd;
      setState(
        ac,
        entities.get(ac)?.state ?? 'off',
        odd ? acOddAttributes() : acAttributes(),
      );
    },
    isAcOdd: () => acOdd,
    setHeating: (state) => {
      const { power, schedule, target } = heatingFixture(state);
      setHeatingParts(
        power,
        schedule === 'on',
        target,
        power === 'off' ? false : undefined,
      );
    },
    getHeating: () =>
      heatingStateOf(
        entities.get(heating)?.state,
        entities.get(heatingSchedule)?.state,
      ),
    setHeatingDemand: (demand) => {
      setDemand(demand ? 100 : 0);
      publish();
    },
    setHeatingPower: (percent) => {
      setDemand(percent);
      publish();
    },
    failHistory: (failing) => {
      historyFails = failing;
      watchers.forEach((watcher) => watcher());
    },
    isHistoryFailing: () => historyFails,
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
      for (const id of calendarKinds.keys()) entities.set(id, make(id, 'off'));
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
      return () => {
        watchers.delete(listener);
      };
    },
  };

  return {
    deps,
    controls,
    /** The mock needs no credentials. */
    getAuth: () => Promise.resolve({} as Auth),
  };
};

import {
  createConnection,
  ERR_CANNOT_CONNECT,
  ERR_INVALID_AUTH,
  callService as haCallService,
  subscribeEntities,
} from 'home-assistant-js-websocket';
import type { Auth, Connection, HassEntity } from 'home-assistant-js-websocket';

import { entityProblem, entityRefs, getConfig } from '@/config/config.ts';
import type {
  CalendarKind,
  EntityDomain,
  RuntimeConfig,
} from '@/config/config.ts';

import {
  CALENDAR_REFRESH_MS,
  calendarWindow,
  fetchCalendarEvents,
  normaliseEvents,
} from './calendar.ts';
import type { CalendarEvent, RawCalendarEvent } from './calendar.ts';
import { cancellableDelay } from './delay.ts';
import { fetchHistory } from './history.ts';
import type { RawHistoryState } from './history.ts';

/** The services each domain accepts through `callService`. */
type DomainServices = {
  switch: 'turn_on' | 'turn_off' | 'toggle';
  button: 'press';
  binary_sensor: never;
  sensor: never;
  weather: never;
  calendar: never;
  climate:
    | 'turn_on'
    | 'turn_off'
    | 'set_hvac_mode'
    | 'set_temperature'
    | 'set_fan_mode'
    | 'set_swing_mode';
};

/** `WeatherEntityFeature.FORECAST_HOURLY`: bit 2 of `supported_features`. */
const FORECAST_HOURLY = 2;

/** How often the forecast is re-fetched; HA pushes no event when it changes. */
export const FORECAST_REFRESH_MS = 30 * 60_000;

/** Longest wait between connect attempts; the library's own reconnects cap at 5s too. */
export const RETRY_MAX_MS = 5_000;

/** Wait before the next connect attempt: 1s, 2s, 4s, then `RETRY_MAX_MS`. */
export const retryDelay = (attempt: number) =>
  Math.min(1000 * 2 ** attempt, RETRY_MAX_MS);

/** One period of a weather entity's hourly forecast. */
export type ForecastItem = {
  datetime: string;
  condition?: string;
  temperature?: number;
  /** Chance of rain, 0 to 100. */
  precipitation_probability?: number;
};

export type ServiceName<D extends EntityDomain> = DomainServices[D];

export type HaStatus =
  'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export type HaSnapshot = {
  status: HaStatus;
  error?: string;
  /** True when HA refused the login, so saved credentials are stale. */
  rejected?: boolean;
  /** When data last arrived (epoch ms). Set while the connection is down. */
  lastUpdate?: number;
  /** Entity IDs the store tracks: the configured ones that pass validation. */
  subscribed: string[];
  /** Current state by entity ID. */
  entities: Partial<Record<string, HassEntity>>;
  /** Last forecast fetched per weather entity; kept while HA is unreachable. */
  forecasts: Partial<Record<string, ForecastItem[]>>;
  /** Last events fetched per calendar entity; kept when a fetch fails. */
  calendars: Partial<Record<string, CalendarEvent[]>>;
  /** When each calendar last loaded (epoch ms), so the tile can tell old events. */
  calendarUpdated: Partial<Record<string, number>>;
  /** True when a calendar has failed to load and has no earlier events to show. */
  calendarFailed: boolean;
};

/** The library calls the store uses, so tests can stand in for HA. */
export type HaDeps = {
  createConnection: typeof createConnection;
  subscribeEntities: typeof subscribeEntities;
  callService: typeof haCallService;
  /** Events of one calendar between two instants, in HA's REST shape. */
  fetchCalendarEvents: (
    auth: Auth,
    entityId: string,
    start: Date,
    end: Date,
  ) => Promise<RawCalendarEvent[]>;
  /** The recorded states of one entity between two instants, oldest first. */
  fetchHistory: (
    auth: Auth,
    entityId: string,
    start: Date,
    end: Date,
  ) => Promise<RawHistoryState[]>;
};

const realDeps: HaDeps = {
  createConnection,
  subscribeEntities,
  callService: haCallService,
  fetchCalendarEvents,
  fetchHistory,
};

const describeError = (err: unknown) => {
  if (err === ERR_INVALID_AUTH) return 'Home Assistant rejected the login';
  if (err === ERR_CANNOT_CONNECT) return 'Cannot reach Home Assistant';
  return err instanceof Error ? err.message : `Connection error (${err})`;
};

export const createHaStore = (
  deps: HaDeps = realDeps,
  cfg: RuntimeConfig = getConfig(),
) => {
  // The same entity may be used by several tiles; it is tracked once.
  const domains = new Map<string, EntityDomain>();
  for (const ref of entityRefs(cfg)) {
    if (!entityProblem(ref)) domains.set(ref.id, ref.domain);
  }
  const tracked = [...domains.keys()];
  const trackedIn = (domain: EntityDomain) =>
    tracked.filter((id) => domains.get(id) === domain);
  // Calendars of one kind get the tidying for it (see `normaliseEvents`).
  const calendarKinds = new Map<string, CalendarKind | undefined>();
  for (const tile of cfg.tiles) {
    if (tile.type !== 'calendar') continue;
    for (const { entity, kind } of tile.calendars)
      calendarKinds.set(entity, kind);
  }

  let snapshot: HaSnapshot = {
    status: 'idle',
    subscribed: tracked,
    entities: {},
    forecasts: {},
    calendars: {},
    calendarUpdated: {},
    calendarFailed: false,
  };
  const listeners = new Set<() => void>();
  const update = (patch: Partial<HaSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener());
  };

  let connection: Connection | undefined;
  let unsubscribe: (() => void) | undefined;
  let forecastTimer: ReturnType<typeof setInterval> | undefined;
  let calendarTimer: ReturnType<typeof setInterval> | undefined;
  // Kept for the calendar's REST calls, which the websocket library cannot make.
  let calendarAuth: Auth | undefined;
  // Calendars whose fetch failed with nothing earlier to show.
  const calendarsFailed = new Set<string>();
  let cancelRetry: (() => void) | undefined;
  // Kept outside the snapshot so HA's event stream doesn't re-render the app.
  let lastSeen: number | undefined;
  // Bumped by every start/stop so a slow connect can tell it was superseded.
  let generation = 0;

  const stop = () => {
    generation++;
    cancelRetry?.();
    lastSeen = undefined;
    unsubscribe?.();
    connection?.close();
    clearInterval(forecastTimer);
    clearInterval(calendarTimer);
    unsubscribe = connection = forecastTimer = calendarTimer = undefined;
    calendarAuth = undefined;
    calendarsFailed.clear();
    update({
      status: 'idle',
      error: undefined,
      rejected: undefined,
      lastUpdate: undefined,
      entities: {},
      forecasts: {},
      calendars: {},
      calendarUpdated: {},
      calendarFailed: false,
    });
  };

  /**
   * Current HA serves forecasts only through `weather.get_forecasts`, not as an
   * attribute. A failed fetch keeps the previous forecast.
   */
  const refreshForecast = async (id: string) => {
    const mine = generation;
    const features = snapshot.entities[id]?.attributes.supported_features;
    if (!connection) return;
    // An entity that cannot do hourly forecasts would only error; show current
    // conditions alone, and drop any forecast from before.
    if (typeof features === 'number' && !(features & FORECAST_HOURLY)) {
      if (snapshot.forecasts[id]) {
        const { [id]: _dropped, ...rest } = snapshot.forecasts;
        update({ forecasts: rest });
      }
      return;
    }
    try {
      const result = (await deps.callService(
        connection,
        'weather',
        'get_forecasts',
        { type: 'hourly' },
        { entity_id: id },
        true,
      )) as { response?: Record<string, { forecast?: ForecastItem[] }> };
      const forecast = result.response?.[id]?.forecast;
      if (mine === generation && forecast) {
        update({ forecasts: { ...snapshot.forecasts, [id]: forecast } });
      }
    } catch (err) {
      console.error(`Forecast for ${id} failed`, err);
    }
  };

  const refreshForecasts = () =>
    trackedIn('weather').forEach((id) => void refreshForecast(id));

  /**
   * Fetches today and the next week of one calendar. A failed fetch keeps the
   * previous events, so the tile never goes blank over a hiccup.
   */
  const refreshCalendar = async (id: string) => {
    const mine = generation;
    const auth = calendarAuth;
    if (!auth) return;
    const { start, end } = calendarWindow();
    try {
      const raw = await deps.fetchCalendarEvents(auth, id, start, end);
      if (mine !== generation) return;
      const events = normaliseEvents(id, raw, calendarKinds.get(id));
      calendarsFailed.delete(id);
      update({
        calendars: { ...snapshot.calendars, [id]: events },
        calendarUpdated: { ...snapshot.calendarUpdated, [id]: Date.now() },
        calendarFailed: calendarsFailed.size > 0,
      });
    } catch (err) {
      console.error(`Calendar ${id} failed`, err);
      if (mine === generation && !snapshot.calendars[id]) {
        calendarsFailed.add(id);
        update({ calendarFailed: true });
      }
    }
  };

  const refreshCalendars = () =>
    trackedIn('calendar').forEach((id) => void refreshCalendar(id));

  /**
   * Retries until HA answers, so a display that wakes before HA is up recovers
   * on its own. A refused login is final. `getAuth` may navigate away to sign
   * in, in which case it never settles.
   */
  const start = async (getAuth: () => Promise<Auth>) => {
    stop();
    const mine = generation;
    update({ status: 'connecting' });
    try {
      const auth = await getAuth();
      let conn: Connection | undefined;
      for (let attempt = 0; !conn; attempt++) {
        try {
          conn = await deps.createConnection({ auth });
        } catch (err) {
          if (err === ERR_INVALID_AUTH || mine !== generation) throw err;
          update({ status: 'error', error: describeError(err) });
          const { done, cancel } = cancellableDelay(retryDelay(attempt));
          cancelRetry = cancel;
          await done;
          if (mine !== generation) return;
        }
      }
      if (mine !== generation) {
        conn.close();
        return;
      }
      connection = conn;
      calendarAuth = auth;
      conn.addEventListener('ready', () => {
        lastSeen = Date.now();
        update({
          status: 'connected',
          error: undefined,
          lastUpdate: undefined,
        });
        refreshForecasts();
        refreshCalendars();
      });
      conn.addEventListener('disconnected', () =>
        update({ status: 'disconnected', lastUpdate: lastSeen }),
      );
      // Fired when a reconnect is refused: the library gives up, so the
      // credentials are stale (connectHa signs in again).
      conn.addEventListener('reconnect-error', () =>
        update({
          status: 'error',
          error: describeError(ERR_INVALID_AUTH),
          rejected: true,
          lastUpdate: lastSeen,
        }),
      );
      // The library has no entity filter: HA sends every entity and the
      // store keeps only the configured ones.
      unsubscribe = deps.subscribeEntities(conn, (all) => {
        lastSeen = Date.now();
        const entities: HaSnapshot['entities'] = {};
        for (const id of tracked) {
          const entity = all[id];
          if (entity) entities[id] = entity;
        }
        const changed = tracked.filter(
          (id) => entities[id] !== snapshot.entities[id],
        );
        if (changed.length > 0) {
          update({ entities });
          const present = (id: string) => entities[id] !== undefined;
          changed
            .filter((id) => domains.get(id) === 'weather' && present(id))
            .forEach((id) => void refreshForecast(id));
          // A calendar entity changes when its current or next event does.
          changed
            .filter((id) => domains.get(id) === 'calendar' && present(id))
            .forEach((id) => void refreshCalendar(id));
        }
      });
      forecastTimer = setInterval(refreshForecasts, FORECAST_REFRESH_MS);
      calendarTimer = setInterval(refreshCalendars, CALENDAR_REFRESH_MS);
      refreshCalendars();
      lastSeen = Date.now();
      update({ status: 'connected', error: undefined });
    } catch (err) {
      if (mine === generation) {
        update({
          status: 'error',
          error: describeError(err),
          rejected: err === ERR_INVALID_AUTH,
        });
      }
    }
  };

  /**
   * Recorded states of a configured entity over a window. Rejects while HA is
   * not connected, so a sheet can show its empty state.
   */
  const history = (id: string, start: Date, end: Date) => {
    const auth = calendarAuth;
    if (!auth || !domains.has(id)) {
      return Promise.reject(new Error(`Cannot read history of ${id}`));
    }
    return deps.fetchHistory(auth, id, start, end);
  };

  const callService = <D extends EntityDomain>(
    domain: D,
    id: string,
    service: ServiceName<D>,
    data?: object,
  ) => {
    if (!connection || domains.get(id) !== domain) {
      return Promise.reject(new Error(`Cannot call ${domain}.${service}`));
    }
    return deps.callService(connection, domain, service, data, {
      entity_id: id,
    });
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    start,
    stop,
    callService,
    history,
  };
};

export type HaStore = ReturnType<typeof createHaStore>;

import {
  createConnection,
  ERR_CANNOT_CONNECT,
  ERR_INVALID_AUTH,
  callService as haCallService,
  subscribeEntities,
} from 'home-assistant-js-websocket';
import type { Auth, Connection, HassEntity } from 'home-assistant-js-websocket';

import { entityProblem, entityRefs, getConfig } from '@/config/config.ts';
import type { EntityDomain, RuntimeConfig } from '@/config/config.ts';

import {
  CALENDAR_REFRESH_MS,
  calendarWindow,
  compileFormat,
  fetchCalendarEvents,
  normaliseEvents,
} from './calendar.ts';
import type {
  CalendarEvent,
  CalendarFormat,
  RawCalendarEvent,
} from './calendar.ts';
import { cancellableDelay } from './delay.ts';
import { fetchHistory } from './history.ts';
import type { RawHistoryState } from './history.ts';

/** The services each domain accepts through `callService`. */
type DomainServices = {
  switch: 'turn_on' | 'turn_off' | 'toggle';
  button: 'press';
  binary_sensor: never;
  sensor: never;
  sun: never;
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

/** `WeatherEntityFeature.FORECAST_DAILY`: bit 1 of `supported_features`. */
const FORECAST_DAILY = 1;

/** `WeatherEntityFeature.FORECAST_HOURLY`: bit 2 of `supported_features`. */
const FORECAST_HOURLY = 2;

type ForecastType = 'hourly' | 'daily';

/** How often the forecast is re-fetched; HA pushes no event when it changes. */
export const FORECAST_REFRESH_MS = 30 * 60_000;

/** Longest wait between connect attempts; the library's own reconnects cap at 5s too. */
export const RETRY_MAX_MS = 5_000;

/** Wait before the next connect attempt: 1s, 2s, 4s, then `RETRY_MAX_MS`. */
export const retryDelay = (attempt: number) =>
  Math.min(1000 * 2 ** attempt, RETRY_MAX_MS);

/**
 * One period of a weather entity's hourly or daily forecast. Every field but
 * the time is optional: integrations differ, and HA leaves out what it lacks.
 */
export type ForecastItem = {
  datetime: string;
  condition?: string;
  /** The high, in a daily forecast. */
  temperature?: number;
  /** The low; daily forecasts only. */
  templow?: number;
  apparent_temperature?: number;
  /** Chance of rain, 0 to 100. */
  precipitation_probability?: number;
  /** Rain in mm. Hourly only, and `null` when the source has no figure. */
  precipitation?: number | null;
  uv_index?: number;
  pressure?: number;
  wind_speed?: number;
  wind_gust_speed?: number;
  /** Degrees, the direction the wind blows from. */
  wind_bearing?: number;
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
  /** Last hourly forecast fetched per weather entity; kept while HA is unreachable. */
  forecasts: Partial<Record<string, ForecastItem[]>>;
  /** Last daily forecast per weather entity, kept the same way. */
  dailyForecasts: Partial<Record<string, ForecastItem[]>>;
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
  // Each calendar's events are tidied by its own options (see `normaliseEvents`).
  const calendarFormats = new Map<string, CalendarFormat>();
  for (const tile of cfg.tiles) {
    if (tile.type !== 'calendar') continue;
    for (const source of tile.calendars)
      calendarFormats.set(source.entity, compileFormat(source));
  }

  let snapshot: HaSnapshot = {
    status: 'idle',
    subscribed: tracked,
    entities: {},
    forecasts: {},
    dailyForecasts: {},
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
  // When each weather entity's forecasts last loaded (epoch ms). Kept outside
  // the snapshot: only `refreshWeather` reads it.
  const forecastFetched = new Map<string, number>();
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
    forecastFetched.clear();
    calendarsFailed.clear();
    update({
      status: 'idle',
      error: undefined,
      rejected: undefined,
      lastUpdate: undefined,
      entities: {},
      forecasts: {},
      dailyForecasts: {},
      calendars: {},
      calendarUpdated: {},
      calendarFailed: false,
    });
  };

  /**
   * Current HA serves forecasts only through `weather.get_forecasts`, not as an
   * attribute. Each type is asked for only when the entity supports it, and a
   * failed fetch keeps the previous forecast.
   */
  const refreshForecastType = async (
    id: string,
    type: ForecastType,
    feature: number,
  ) => {
    const mine = generation;
    const key = type === 'hourly' ? 'forecasts' : 'dailyForecasts';
    const features = snapshot.entities[id]?.attributes.supported_features;
    if (!connection) return;
    // An entity that cannot do this forecast would only error; drop any
    // forecast from before and show what it does support.
    if (typeof features === 'number' && !(features & feature)) {
      if (snapshot[key][id]) {
        const { [id]: _dropped, ...rest } = snapshot[key];
        update({ [key]: rest });
      }
      return;
    }
    try {
      const result = (await deps.callService(
        connection,
        'weather',
        'get_forecasts',
        { type },
        { entity_id: id },
        true,
      )) as { response?: Record<string, { forecast?: ForecastItem[] }> };
      const forecast = result.response?.[id]?.forecast;
      if (mine === generation && forecast) {
        forecastFetched.set(id, Date.now());
        update({ [key]: { ...snapshot[key], [id]: forecast } });
      }
    } catch (err) {
      console.error(`Forecast (${type}) for ${id} failed`, err);
    }
  };

  const refreshForecast = (id: string) =>
    Promise.all([
      refreshForecastType(id, 'hourly', FORECAST_HOURLY),
      refreshForecastType(id, 'daily', FORECAST_DAILY),
    ]);

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
      const events = normaliseEvents(id, raw, calendarFormats.get(id));
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
      let attempt = 0;
      while (!conn) {
        try {
          conn = await deps.createConnection({ auth });
        } catch (err) {
          if (err === ERR_INVALID_AUTH || mine !== generation) throw err;
          update({ status: 'error', error: describeError(err) });
          const { done, cancel } = cancellableDelay(retryDelay(attempt++));
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
   * Re-reads a weather entity's forecasts unless they loaded less than
   * `maxAgeMs` ago, so a sheet opening shows current figures without a fetch on
   * every tap. Never rejects: a failure keeps the earlier forecast.
   */
  const refreshWeather = async (id: string, maxAgeMs: number) => {
    if (domains.get(id) !== 'weather') return;
    const fetched = forecastFetched.get(id);
    if (fetched !== undefined && Date.now() - fetched < maxAgeMs) return;
    await refreshForecast(id);
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
      return () => {
        listeners.delete(listener);
      };
    },
    start,
    stop,
    callService,
    history,
    refreshWeather,
  };
};

export type HaStore = ReturnType<typeof createHaStore>;

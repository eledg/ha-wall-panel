import {
  createConnection,
  ERR_CANNOT_CONNECT,
  ERR_INVALID_AUTH,
  callService as haCallService,
  subscribeEntities,
} from 'home-assistant-js-websocket';
import type { Auth, Connection, HassEntity } from 'home-assistant-js-websocket';

import { config, validateConfig } from '../config.ts';

type Entities = typeof config.entities;
export type EntityKey = keyof Entities;

/** The services each domain accepts through `callService`. */
type DomainServices = {
  switch: 'turn_on' | 'turn_off' | 'toggle';
  sensor: never;
  weather: never;
};

/** `WeatherEntityFeature.FORECAST_HOURLY`: bit 2 of `supported_features`. */
const FORECAST_HOURLY = 2;

/** How often the forecast is re-fetched; HA pushes no event when it changes. */
export const FORECAST_REFRESH_MS = 30 * 60_000;

/** One period of a weather entity's hourly forecast. */
export type ForecastItem = {
  datetime: string;
  condition?: string;
  temperature?: number;
};
export type ServiceName<K extends EntityKey> =
  DomainServices[Entities[K]['domain']];

export type HaStatus =
  'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export type HaSnapshot = {
  status: HaStatus;
  error?: string;
  /** True when HA refused the login, so saved credentials are stale. */
  rejected?: boolean;
  /** Entity IDs the store tracks: the configured ones that pass validation. */
  subscribed: string[];
  entities: Partial<Record<EntityKey, HassEntity>>;
  /** Last forecast fetched per weather entity; kept while HA is unreachable. */
  forecasts: Partial<Record<EntityKey, ForecastItem[]>>;
};

/** The library calls the store uses, so tests can stand in for HA. */
export type HaDeps = {
  createConnection: typeof createConnection;
  subscribeEntities: typeof subscribeEntities;
  callService: typeof haCallService;
};

const realDeps: HaDeps = {
  createConnection,
  subscribeEntities,
  callService: haCallService,
};

const describeError = (err: unknown) => {
  if (err === ERR_INVALID_AUTH) return 'Home Assistant rejected the login';
  if (err === ERR_CANNOT_CONNECT) return 'Cannot reach Home Assistant';
  return err instanceof Error ? err.message : `Connection error (${err})`;
};

export const createHaStore = (
  deps: HaDeps = realDeps,
  cfg: typeof config = config,
) => {
  const invalid = new Set(validateConfig(cfg).map(({ key }) => key));
  const tracked = (Object.keys(cfg.entities) as EntityKey[]).filter(
    (key) => !invalid.has(key),
  );

  let snapshot: HaSnapshot = {
    status: 'idle',
    subscribed: tracked.map((key) => cfg.entities[key].id),
    entities: {},
    forecasts: {},
  };
  const listeners = new Set<() => void>();
  const update = (patch: Partial<HaSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener());
  };

  let connection: Connection | undefined;
  let unsubscribe: (() => void) | undefined;
  let forecastTimer: ReturnType<typeof setInterval> | undefined;
  // Bumped by every start/stop so a slow connect can tell it was superseded.
  let generation = 0;

  const stop = () => {
    generation++;
    unsubscribe?.();
    connection?.close();
    clearInterval(forecastTimer);
    unsubscribe = connection = forecastTimer = undefined;
    update({
      status: 'idle',
      error: undefined,
      rejected: undefined,
      entities: {},
      forecasts: {},
    });
  };

  /**
   * Current HA serves forecasts only through `weather.get_forecasts`, not as an
   * attribute. A failed fetch keeps the previous forecast.
   */
  const refreshForecast = async (key: EntityKey) => {
    const { id } = cfg.entities[key];
    const mine = generation;
    const features = snapshot.entities[key]?.attributes.supported_features;
    if (!connection) return;
    // An entity that cannot do hourly forecasts would only error; show current
    // conditions alone, and drop any forecast from before.
    if (typeof features === 'number' && !(features & FORECAST_HOURLY)) {
      if (snapshot.forecasts[key]) {
        const { [key]: _dropped, ...rest } = snapshot.forecasts;
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
        update({ forecasts: { ...snapshot.forecasts, [key]: forecast } });
      }
    } catch (err) {
      console.error(`Forecast for ${id} failed`, err);
    }
  };

  const refreshForecasts = () =>
    tracked
      .filter((key) => cfg.entities[key].domain === 'weather')
      .forEach((key) => void refreshForecast(key));

  /** `getAuth` may navigate away to sign in, in which case it never settles. */
  const start = async (getAuth: () => Promise<Auth>) => {
    stop();
    const mine = generation;
    update({ status: 'connecting' });
    try {
      const conn = await deps.createConnection({ auth: await getAuth() });
      if (mine !== generation) {
        conn.close();
        return;
      }
      connection = conn;
      conn.addEventListener('ready', () => {
        update({ status: 'connected' });
        refreshForecasts();
      });
      conn.addEventListener('disconnected', () =>
        update({ status: 'disconnected' }),
      );
      // The library has no entity filter: HA sends every entity and the
      // store keeps only the configured ones.
      unsubscribe = deps.subscribeEntities(conn, (all) => {
        const entities: HaSnapshot['entities'] = {};
        for (const key of tracked) {
          const entity = all[cfg.entities[key].id];
          if (entity) entities[key] = entity;
        }
        const changed = tracked.filter(
          (key) => entities[key] !== snapshot.entities[key],
        );
        if (changed.length > 0) {
          update({ entities });
          changed
            .filter((key) => cfg.entities[key].domain === 'weather')
            .filter((key) => entities[key])
            .forEach((key) => void refreshForecast(key));
        }
      });
      forecastTimer = setInterval(refreshForecasts, FORECAST_REFRESH_MS);
      update({ status: 'connected' });
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

  const callService = <K extends EntityKey>(
    key: K,
    service: ServiceName<K>,
    data?: object,
  ) => {
    const { domain, id } = cfg.entities[key];
    if (!connection || invalid.has(key)) {
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
  };
};

export type HaStore = ReturnType<typeof createHaStore>;

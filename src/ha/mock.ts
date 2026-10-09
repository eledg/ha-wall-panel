import type { Auth, Connection, HassEntity } from 'home-assistant-js-websocket';

import { config } from '../config.ts';
import type { HaDeps } from './store.ts';

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
};

const SWITCH_SERVICES = ['turn_on', 'turn_off', 'toggle'];

export const createMockHa = (cfg: typeof config = config) => {
  const entities = new Map<string, HassEntity>();
  const subscribers = new Set<(all: Record<string, HassEntity>) => void>();

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
  const lux = cfg.entities.officeIlluminance.id;
  entities.set(light, make(light, 'off'));
  entities.set(lux, make(lux, '120', { unit_of_measurement: 'lx' }));
  entities.set(UNRELATED_ID, make(UNRELATED_ID, 'off'));

  const setState: MockControls['setState'] = (id, state, attributes) => {
    // A new object per change, as the real library gives, so the store's
    // reference comparison sees it.
    entities.set(
      id,
      make(id, state, attributes ?? entities.get(id)?.attributes),
    );
    const all = Object.fromEntries(entities);
    subscribers.forEach((subscriber) => subscriber(all));
  };

  const connection = {
    addEventListener: () => {},
    removeEventListener: () => {},
    close: () => {},
  } as unknown as Connection;

  const deps = {
    createConnection: () => Promise.resolve(connection),
    subscribeEntities: (_conn, onChange) => {
      subscribers.add(onChange);
      onChange(Object.fromEntries(entities));
      return () => void subscribers.delete(onChange);
    },
    callService: (_conn, domain, service, _data, target) => {
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
  };

  return {
    deps,
    controls,
    /** The mock needs no credentials. */
    getAuth: () => Promise.resolve({} as Auth),
  };
};

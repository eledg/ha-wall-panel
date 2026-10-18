import type { HassEntity } from 'home-assistant-js-websocket';

/** True when the entity exists and HA can act on it. */
export const isUsable = (entity: HassEntity | undefined) =>
  entity !== undefined &&
  entity.state !== 'unavailable' &&
  entity.state !== 'unknown';

/** A finite number, or `undefined`. Strings are not parsed: see `parseNumber`. */
export const num = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/** A finite number from a number or numeric string (a sensor's state), or `undefined`. */
export const parseNumber = (raw: unknown) =>
  num(typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw);

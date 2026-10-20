import type { HassEntity } from 'home-assistant-js-websocket';

import { isUsable, parseNumber } from '@/services/ha/entity.ts';

/** The reading to show: a number when HA gave a usable one. */
export type TemperatureView = { value: number | undefined };

/**
 * Reads the temperature from an entity's `attribute`, or from its state when
 * no attribute is given (a `sensor`). Anything unusable gives `undefined`.
 */
export const readTemperature = (
  entity: HassEntity | undefined,
  attribute?: string,
): TemperatureView => {
  if (!entity || !isUsable(entity)) return { value: undefined };
  const raw = attribute ? entity.attributes[attribute] : entity.state;
  return { value: parseNumber(raw) };
};

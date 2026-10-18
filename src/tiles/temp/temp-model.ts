import type { HassEntity } from 'home-assistant-js-websocket';

import { isUsable, parseNumber } from '../../ha/entity.ts';

/** The reading to show: a number when HA gave a usable one. */
export type TempView = { value: number | undefined };

/**
 * Reads the temperature from an entity's `attribute`, or from its state when
 * no attribute is given (a `sensor`). Anything unusable gives `undefined`.
 */
export const readTemp = (
  entity: HassEntity | undefined,
  attribute?: string,
): TempView => ({
  value:
    entity && isUsable(entity)
      ? parseNumber(attribute ? entity.attributes[attribute] : entity.state)
      : undefined,
});

/** One decimal, as the design shows it (`21.4`). */
export const formatTemp = (value: number) => value.toFixed(1);

/** Whole percent, as the design shows it (`51%`). */
export const formatHumidity = (value: number) => `${Math.round(value)}%`;

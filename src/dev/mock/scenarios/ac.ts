/** The office AC's attributes, in the shape the real climate entity reports. */
export const acAttributes = (): Record<string, unknown> => ({
  friendly_name: 'climate.air_conditioning_office',
  hvac_modes: ['off', 'cool', 'heat', 'fan_only', 'dry', 'auto'],
  min_temp: 16,
  max_temp: 30,
  target_temp_step: 0.5,
  temperature: 24,
  current_temperature: 24,
  fan_modes: ['Quiet', 'low', 'medium', 'high', 'auto'],
  fan_mode: 'auto',
  swing_modes: ['Vertical Swing', 'Highest', 'High', 'Low', 'Lowest'],
  swing_mode: 'Vertical Swing',
  supported_features: 425,
});

/** Attributes with holes and an option the tile has no label for. */
export const acOddAttributes = (): Record<string, unknown> => {
  const { current_temperature: _current, ...rest } = acAttributes();
  return { ...rest, fan_modes: ['turbo', 'auto'], fan_mode: 'turbo' };
};

/** The mode `climate.turn_on` brings back when none was used before. */
export const AC_DEFAULT_MODE = 'cool';

/**
 * Applies a `climate.*` service to the AC, as HA would: returns the new state
 * and attributes, or throws for a value the entity doesn't offer.
 */
export const applyClimateService = (
  state: string,
  attributes: Record<string, unknown>,
  service: string,
  lastMode: string,
  data: Record<string, unknown> = {},
): { state: string; attributes: Record<string, unknown> } => {
  const options = (key: string) => (attributes[key] ?? []) as string[];
  const oneOf = (field: string, list: string) => {
    const value = data[field];
    if (typeof value !== 'string' || !options(list).includes(value)) {
      throw new Error(`Mock HA: ${String(value)} is not a ${field}`);
    }
    return value;
  };

  switch (service) {
    case 'turn_on':
      return { state: state === 'off' ? lastMode : state, attributes };
    case 'turn_off':
      return { state: 'off', attributes };
    case 'set_hvac_mode':
      return { state: oneOf('hvac_mode', 'hvac_modes'), attributes };
    case 'set_fan_mode':
      return {
        state,
        attributes: { ...attributes, fan_mode: oneOf('fan_mode', 'fan_modes') },
      };
    case 'set_swing_mode':
      return {
        state,
        attributes: {
          ...attributes,
          swing_mode: oneOf('swing_mode', 'swing_modes'),
        },
      };
    case 'set_temperature': {
      const temperature = data.temperature;
      const min = attributes.min_temp as number;
      const max = attributes.max_temp as number;
      const step = attributes.target_temp_step as number;
      if (
        typeof temperature !== 'number' ||
        temperature < min ||
        temperature > max ||
        Math.abs(temperature / step - Math.round(temperature / step)) > 1e-9
      ) {
        throw new Error(
          `Mock HA: ${String(temperature)} is not a valid target`,
        );
      }
      return { state, attributes: { ...attributes, temperature } };
    }
    default:
      throw new Error(`Mock HA: no service climate.${service}`);
  }
};

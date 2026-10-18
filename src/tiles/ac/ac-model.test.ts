import type { HassEntity } from 'home-assistant-js-websocket';
import { describe, expect, it } from 'vitest';

import {
  acStatus,
  formatTemp,
  modeLabel,
  optionLabel,
  readAc,
  stepTarget,
} from './ac-model.ts';

const entity = (
  state: string,
  attributes: Record<string, unknown> = {},
): HassEntity =>
  ({ entity_id: 'climate.x', state, attributes }) as unknown as HassEntity;

const full = {
  hvac_modes: ['off', 'cool', 'heat'],
  temperature: 22,
  current_temperature: 23.5,
  min_temp: 16,
  max_temp: 30,
  target_temp_step: 0.5,
  fan_modes: ['Quiet', 'low'],
  fan_mode: 'low',
  swing_modes: ['Vertical Swing', 'High'],
  swing_mode: 'High',
};

describe('readAc', () => {
  it('reads an AC that is on', () => {
    expect(readAc(entity('heat', full))).toEqual({
      usable: true,
      on: true,
      mode: 'heat',
      modes: ['cool', 'heat'],
      target: 22,
      current: 23.5,
      fan: 'low',
      fanModes: ['Quiet', 'low'],
      swing: 'High',
      swingModes: ['Vertical Swing', 'High'],
      min: 16,
      max: 30,
      step: 0.5,
    });
  });

  it('offers the first selectable mode while off', () => {
    const view = readAc(entity('off', full));

    expect(view.on).toBe(false);
    expect(view.usable).toBe(true);
    expect(view.mode).toBe('cool');
  });

  it('is not usable when missing, unavailable or unknown', () => {
    expect(readAc(undefined).usable).toBe(false);
    expect(readAc(entity('unavailable', full))).toMatchObject({
      usable: false,
      on: false,
    });
    expect(readAc(entity('unknown', full)).usable).toBe(false);
  });

  it('falls back when attributes are missing or the wrong type', () => {
    expect(
      readAc(
        entity('cool', {
          temperature: '22',
          min_temp: null,
          target_temp_step: 0,
          fan_modes: 'low',
          fan_mode: '',
        }),
      ),
    ).toMatchObject({
      target: undefined,
      current: undefined,
      fan: undefined,
      fanModes: [],
      swingModes: [],
      modes: [],
      min: 16,
      max: 30,
      step: 0.5,
    });
  });
});

describe('stepTarget', () => {
  const limits = { min: 16, max: 30, step: 0.5 };

  it('steps by the entity step without float drift', () => {
    expect(stepTarget(21, 1, limits)).toBe(21.5);
    expect(stepTarget(21, -1, limits)).toBe(20.5);
    expect(stepTarget(20.1, 1, { ...limits, step: 0.1 })).toBe(20.2);
  });

  it('stops at the limits', () => {
    expect(stepTarget(30, 1, limits)).toBe(30);
    expect(stepTarget(16, -1, limits)).toBe(16);
  });
});

describe('labels', () => {
  it('formats temperatures to the step', () => {
    expect(formatTemp(24, 0.5)).toBe('24.0');
    expect(formatTemp(24.5, 0.5)).toBe('24.5');
    expect(formatTemp(24, 1)).toBe('24');
  });

  it('labels modes and options', () => {
    expect(modeLabel('fan_only')).toBe('Fan');
    expect(modeLabel('turbo')).toBe('Turbo');
    expect(optionLabel('low')).toBe('Low');
    expect(optionLabel('Vertical Swing')).toBe('Swing');
    expect(optionLabel('Highest')).toBe('Highest');
  });
});

describe('acStatus', () => {
  const on = {
    usable: true,
    on: true,
    mode: 'cool',
    fan: 'auto',
    fanModes: ['low', 'auto'],
  };
  const off = { ...on, on: false };

  it('describes what the AC is doing', () => {
    expect(acStatus(on)).toBe('Cooling · Fan Auto');
    expect(acStatus({ ...on, mode: 'fan_only' })).toBe('Fan only · Fan Auto');
    expect(acStatus({ ...on, mode: 'turbo' })).toBe('On · Fan Auto');
    expect(acStatus(off)).toBe('AC off');
  });

  it('says when the fan has no options', () => {
    expect(acStatus({ ...on, fanModes: [] })).toBe('Cooling · Fan unavailable');
    expect(acStatus({ ...on, fan: undefined })).toBe(
      'Cooling · Fan unavailable',
    );
  });

  it('reports a power change that HA has not confirmed', () => {
    expect(acStatus(off, true)).toBe('Turning on…');
    expect(acStatus(on, false)).toBe('Turning off…');
    expect(acStatus(on, true)).toBe('Cooling · Fan Auto');
  });

  it('warns when the entity is unavailable', () => {
    expect(acStatus({ ...on, usable: false })).toBe('AC unavailable');
  });
});

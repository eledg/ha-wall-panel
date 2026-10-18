import type { HassEntity } from 'home-assistant-js-websocket';
import { describe, expect, it } from 'vitest';

import {
  canBoost,
  canResume,
  heatingStatus,
  readHeating,
} from './heating-model.ts';
import { stepTarget } from '../target.ts';

const entity = (
  state: string,
  attributes: Record<string, unknown> = {},
): HassEntity =>
  ({ entity_id: 'x.y', state, attributes }) as unknown as HassEntity;

const attrs = { temperature: 20, current_temperature: 19.9 };
const read = (
  power: string,
  schedule: string,
  { demand = 'off', cloud = 'on' } = {},
) =>
  readHeating(
    entity(power, attrs),
    entity(schedule),
    entity(demand),
    entity(cloud),
  );

describe('readHeating', () => {
  it.each([
    ['heat', 'on', 'schedule'],
    ['heat', 'off', 'manual'],
    ['off', 'off', 'off'],
    ['off', 'on', 'paused'],
  ] as const)('power %s with schedule %s is %s', (power, schedule, state) => {
    expect(read(power, schedule).state).toBe(state);
  });

  it('reads the target and room temperature', () => {
    const view = read('heat', 'on');

    expect(view).toMatchObject({
      usable: true,
      on: true,
      target: 20,
      current: 19.9,
      min: 5,
      max: 30,
      step: 0.5,
    });
  });

  it('follows demand on its own, whatever the state', () => {
    for (const [power, schedule] of [
      ['heat', 'on'],
      ['heat', 'off'],
      ['off', 'off'],
      ['off', 'on'],
    ]) {
      expect(read(power!, schedule!, { demand: 'on' }).demand).toBe(true);
      expect(read(power!, schedule!).demand).toBe(false);
    }
  });

  it('is unusable when the climate or schedule is unavailable', () => {
    expect(read('unavailable', 'on').usable).toBe(false);
    expect(read('heat', 'unavailable').usable).toBe(false);
    expect(read('unknown', 'on').usable).toBe(false);
  });

  it('is unusable, with no demand, when the Tado cloud connection drops', () => {
    const view = read('heat', 'on', { demand: 'on', cloud: 'off' });

    expect(view.usable).toBe(false);
    expect(view.demand).toBe(false);
  });

  it('survives missing entities', () => {
    const view = readHeating(undefined, undefined, undefined, undefined);

    expect(view).toMatchObject({
      usable: false,
      on: false,
      target: undefined,
      current: undefined,
      min: 5,
      max: 30,
    });
  });
});

describe('what the sheet allows', () => {
  it('resumes in Manual and Off only', () => {
    expect(canResume(read('heat', 'off'))).toBe(true);
    expect(canResume(read('off', 'off'))).toBe(true);
    expect(canResume(read('heat', 'on'))).toBe(false);
    expect(canResume(read('off', 'on'))).toBe(false);
    expect(canResume(read('heat', 'off', { cloud: 'off' }))).toBe(false);
  });

  it('boosts only while on and reachable', () => {
    expect(canBoost(read('heat', 'on'))).toBe(true);
    expect(canBoost(read('heat', 'off'))).toBe(true);
    expect(canBoost(read('off', 'off'))).toBe(false);
    expect(canBoost(read('off', 'on'))).toBe(false);
    expect(canBoost(read('heat', 'on', { cloud: 'off' }))).toBe(false);
  });

  it('steps the target by half a degree within 5 to 30', () => {
    const view = read('heat', 'on');

    expect(stepTarget(20, 1, view)).toBe(20.5);
    expect(stepTarget(20, -1, view)).toBe(19.5);
    expect(stepTarget(30, 1, view)).toBe(30);
    expect(stepTarget(5, -1, view)).toBe(5);
    expect(stepTarget(5.5, -1, view)).toBe(5);
  });
});

describe('heatingStatus', () => {
  it('says what the heating is doing', () => {
    expect(heatingStatus(read('heat', 'on'), false)).toBe('Following schedule');
    expect(heatingStatus(read('heat', 'off'), false)).toBe('Manual target');
    expect(heatingStatus(read('off', 'off'), false)).toBe('Heating off');
    expect(heatingStatus(read('off', 'on'), false)).toBe(
      'Heating paused. It will resume automatically.',
    );
    expect(heatingStatus(read('unavailable', 'on'), false)).toBe(
      'Heating unavailable',
    );
    expect(heatingStatus(read('heat', 'on'), true)).toBe(
      'Last known readings · stale',
    );
  });

  it('shows a power change that HA has not confirmed yet', () => {
    expect(heatingStatus(read('off', 'off'), false, true)).toBe('Turning on…');
    expect(heatingStatus(read('heat', 'on'), false, false)).toBe(
      'Turning off…',
    );
  });
});

import type { HassEntity } from 'home-assistant-js-websocket';
import { describe, expect, it } from 'vitest';

import { createRingDetector } from './ring.ts';

const ID = 'event.front_door_ring';
const NOW = Date.parse('2026-03-14T09:41:00Z');

const ring = (state: string, eventType = 'ring') =>
  ({
    entity_id: ID,
    state,
    attributes: { event_type: eventType, event_types: ['ring'] },
  }) as unknown as HassEntity;

const at = (ms: number) => new Date(NOW + ms).toISOString();

const setup = () => {
  let time = NOW;
  const detect = createRingDetector({ now: () => time });
  return {
    detect: (entity: HassEntity | undefined) => detect(ID, entity),
    advance: (ms: number) => {
      time += ms;
    },
  };
};

describe('createRingDetector', () => {
  it('fires on a change to a new, fresh ring', () => {
    const { detect } = setup();
    expect(detect(ring(at(-60 * 60_000)))).toBe(false);
    expect(detect(ring(at(0)))).toBe(true);
  });

  it('ignores the first state, however fresh', () => {
    const { detect } = setup();
    expect(detect(ring(at(0)))).toBe(false);
  });

  it('ignores the same state re-sent on reconnect', () => {
    const { detect } = setup();
    detect(ring(at(-60_000)));
    expect(detect(ring(at(-60_000)))).toBe(false);
  });

  it('starts over when the entity disappears, as when the store restarts', () => {
    const { detect } = setup();
    detect(ring(at(-60_000)));
    detect(undefined);
    expect(detect(ring(at(0)))).toBe(false);
  });

  it('ignores unknown and unavailable', () => {
    const { detect } = setup();
    detect(ring(at(-60_000)));
    expect(detect(ring('unavailable'))).toBe(false);
    expect(detect(ring('unknown'))).toBe(false);
  });

  it('fires on a fresh ring after unknown: the first ring after HA restarts', () => {
    const { detect } = setup();
    detect(ring('unknown'));
    expect(detect(ring(at(0)))).toBe(true);
  });

  it('ignores an old ring that comes back after unavailable', () => {
    const { detect } = setup();
    detect(ring('unavailable'));
    expect(detect(ring(at(-60 * 60_000)))).toBe(false);
  });

  it('ignores a ring more than a few seconds from now', () => {
    const { detect } = setup();
    detect(ring('unknown'));
    expect(detect(ring(at(-11_000)))).toBe(false);
    expect(detect(ring(at(11_000)))).toBe(false);
  });

  it('ignores another event type', () => {
    const { detect } = setup();
    detect(ring('unknown'));
    expect(detect(ring(at(0), 'motion'))).toBe(false);
  });

  it('counts the two events of one press once', () => {
    const { detect, advance } = setup();
    detect(ring('unknown'));
    expect(detect(ring(at(0)))).toBe(true);
    advance(160);
    expect(detect(ring(at(160)))).toBe(false);
  });

  it('fires again for a press after the debounce window', () => {
    const { detect, advance } = setup();
    detect(ring('unknown'));
    expect(detect(ring(at(0)))).toBe(true);
    advance(6_000);
    expect(detect(ring(at(6_000)))).toBe(true);
  });

  it('keeps each doorbell apart', () => {
    let time = NOW;
    const detect = createRingDetector({ now: () => time });
    detect('event.a', ring('unknown'));
    detect('event.b', ring('unknown'));
    expect(detect('event.a', ring(at(0)))).toBe(true);
    time += 100;
    expect(detect('event.b', ring(at(100)))).toBe(true);
  });
});

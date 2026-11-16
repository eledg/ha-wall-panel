import type { HassEntity } from 'home-assistant-js-websocket';
import { describe, expect, it } from 'vitest';

import { recentRing } from './door.ts';

const NOW = Date.parse('2026-03-14T09:41:00Z');
const ring = (state: string) => ({ state }) as HassEntity;
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe('recentRing', () => {
  it('is the time of a ring within the last 30 minutes', () => {
    expect(recentRing(ring(ago(29 * 60_000)), NOW)).toBe(NOW - 29 * 60_000);
  });

  it('is undefined for an older ring', () => {
    expect(recentRing(ring(ago(30 * 60_000)), NOW)).toBeUndefined();
  });

  it('allows a ring a few seconds ahead of the clock', () => {
    expect(recentRing(ring(ago(-5_000)), NOW)).toBe(NOW + 5_000);
    expect(recentRing(ring(ago(-60_000)), NOW)).toBeUndefined();
  });

  it('is undefined when the doorbell has not rung', () => {
    expect(recentRing(ring('unknown'), NOW)).toBeUndefined();
    expect(recentRing(ring('unavailable'), NOW)).toBeUndefined();
    expect(recentRing(undefined, NOW)).toBeUndefined();
  });
});

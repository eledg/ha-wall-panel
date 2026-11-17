import type { HassEntity } from 'home-assistant-js-websocket';
import { describe, expect, it } from 'vitest';

import { recentRing } from './door.ts';

const NOW = Date.parse('2026-03-14T09:41:00Z');
const ring = (state: string) => ({ state }) as HassEntity;
const WINDOW = 30 * 60_000;
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe('recentRing', () => {
  it('is the time of a ring within the last 30 minutes', () => {
    expect(recentRing(ring(ago(29 * 60_000)), NOW, WINDOW)).toBe(
      NOW - 29 * 60_000,
    );
  });

  it('is undefined for an older ring', () => {
    expect(recentRing(ring(ago(30 * 60_000)), NOW, WINDOW)).toBeUndefined();
  });

  it('allows a ring a few seconds ahead of the clock', () => {
    expect(recentRing(ring(ago(-5_000)), NOW, WINDOW)).toBe(NOW + 5_000);
    expect(recentRing(ring(ago(-60_000)), NOW, WINDOW)).toBeUndefined();
  });

  it('is undefined when the doorbell has not rung', () => {
    expect(recentRing(ring('unknown'), NOW, WINDOW)).toBeUndefined();
    expect(recentRing(ring('unavailable'), NOW, WINDOW)).toBeUndefined();
    expect(recentRing(undefined, NOW, WINDOW)).toBeUndefined();
  });

  it('uses the given window', () => {
    expect(recentRing(ring(ago(5 * 60_000)), NOW, 60_000)).toBeUndefined();
    expect(recentRing(ring(ago(5 * 60_000)), NOW, 10 * 60_000)).toBe(
      NOW - 5 * 60_000,
    );
  });

  it('hides a ring at or before the dismissed one', () => {
    const at = NOW - 60_000;
    expect(recentRing(ring(ago(60_000)), NOW, WINDOW, at)).toBeUndefined();
    expect(recentRing(ring(ago(60_000)), NOW, WINDOW, at + 1)).toBeUndefined();
    expect(recentRing(ring(ago(60_000)), NOW, WINDOW, at - 1)).toBe(at);
  });
});

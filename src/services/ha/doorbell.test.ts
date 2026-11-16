import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMockHa } from '@/dev/mock/engine.ts';
import { entityId } from '@/tests/ids.ts';

import { createDoorbell, type DoorEvent } from './doorbell.ts';
import { createHaStore } from './store.ts';

const RING = entityId('doorRing');

const setup = async () => {
  vi.useFakeTimers();
  const mock = createMockHa();
  const store = createHaStore(mock.deps);
  const doorbell = createDoorbell(store);
  const rings: DoorEvent[] = [];
  doorbell.subscribe((event) => rings.push(event));
  await store.start(mock.getAuth);
  return { mock: mock.controls, store, doorbell, rings };
};

afterEach(() => {
  vi.useRealTimers();
});

describe('createDoorbell', () => {
  it('raises one ring per press', async () => {
    const { mock, rings } = await setup();

    mock.ring();
    expect(rings).toEqual([
      { kind: 'ring', tileId: 'door', at: expect.any(Number) as number },
    ]);
  });

  it('counts the two events of one press once', async () => {
    const { mock, rings } = await setup();

    mock.ring(true);
    await vi.advanceTimersByTimeAsync(200);
    expect(rings).toHaveLength(1);
  });

  it('raises a second ring for a later press', async () => {
    const { mock, rings } = await setup();

    mock.ring();
    await vi.advanceTimersByTimeAsync(6_000);
    mock.ring();
    expect(rings).toHaveLength(2);
  });

  it('does not ring for the state it connects with', async () => {
    vi.useFakeTimers();
    const mock = createMockHa();
    mock.controls.setState(RING, new Date().toISOString(), {
      event_type: 'ring',
    });
    const store = createHaStore(mock.deps);
    const doorbell = createDoorbell(store);
    const rings: DoorEvent[] = [];
    doorbell.subscribe((event) => rings.push(event));
    await store.start(mock.getAuth);

    expect(rings).toEqual([]);
  });

  it('does not ring again when the connection comes back', async () => {
    const { mock, rings } = await setup();

    mock.ring();
    mock.setConnected(false);
    await vi.advanceTimersByTimeAsync(10_000);
    mock.setConnected(true);
    expect(rings).toHaveLength(1);
  });

  it('does not ring when the doorbell comes back from unavailable', async () => {
    const { mock, rings } = await setup();

    mock.ring();
    const last = mock.getState(RING)!;
    await vi.advanceTimersByTimeAsync(60_000);
    mock.setUnavailable(RING);
    mock.setState(RING, last.state, last.attributes);
    expect(rings).toHaveLength(1);
  });

  it('passes on a tap on the tile', async () => {
    const { doorbell, rings } = await setup();

    doorbell.open('door');
    expect(rings).toEqual([
      { kind: 'open', tileId: 'door', at: expect.any(Number) as number },
    ]);
  });

  it('stops watching when stopped', async () => {
    const { mock, doorbell, rings } = await setup();

    doorbell.stop();
    mock.ring();
    expect(rings).toEqual([]);
  });
});

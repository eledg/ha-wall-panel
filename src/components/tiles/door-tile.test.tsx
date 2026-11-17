// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HaConnection } from '@/components/layout/ha-connection.tsx';
import { createMockHa } from '@/dev/mock/engine.ts';
import { createDoorDismissals } from '@/lib/door-dismissed.ts';
import { createDoorbell, type DoorEvent } from '@/services/ha/doorbell.ts';
import { createHaStore } from '@/services/ha/store.ts';
import { entityId, tileOf } from '@/tests/ids.ts';

import { DoorTile } from './door-tile.tsx';

const RING = entityId('doorRing');
const CAMERA = entityId('doorCamera');

const setup = async () => {
  const mock = createMockHa();
  const store = createHaStore(mock.deps);
  const doorbell = createDoorbell(store);
  const dismissals = createDoorDismissals();
  const events: DoorEvent[] = [];
  doorbell.subscribe((event) => events.push(event));
  await act(async () => {
    await store.start(mock.getAuth);
    render(
      <HaConnection store={store}>
        <DoorTile
          tile={tileOf('door')}
          store={store}
          doorbell={doorbell}
          dismissals={dismissals}
        />
      </HaConnection>,
      document.body,
    );
  });
  const button = () => document.querySelector('button');
  const tile = () => document.querySelector('.tile-place')!;
  return { mock, store, events, button, tile, dismissals };
};

afterEach(() => {
  render(null, document.body);
  vi.useRealTimers();
});

describe('DoorTile', () => {
  it('shows the label and a camera badge before any ring', async () => {
    const { tile } = await setup();

    expect(tile().textContent).toContain('Front door');
    expect(tile().textContent).not.toContain('Rang');
  });

  it('shows the time of a recent ring', async () => {
    const { mock, tile } = await setup();

    await act(() =>
      mock.controls.setState(RING, '2020-01-01T09:41:00Z', {
        event_type: 'ring',
      }),
    );
    expect(tile().textContent).not.toContain('Rang');

    await act(() => mock.controls.ring());
    expect(tile().textContent).toContain('Rang');
    expect(tile().querySelector('time')).not.toBeNull();
  });

  it('hides a dismissed ring, but shows a later one', async () => {
    const { mock, store, tile, dismissals } = await setup();
    await act(() => mock.controls.ring());
    const rangAt = Date.parse(store.getSnapshot().entities[RING]!.state);

    await act(async () => dismissals.dismiss('door', rangAt));
    expect(tile().textContent).not.toContain('Rang');

    await act(() =>
      mock.controls.setState(RING, new Date(rangAt + 5_000).toISOString(), {
        event_type: 'ring',
      }),
    );
    expect(tile().textContent).toContain('Rang');
  });

  it('opens the camera on tap, without a ring', async () => {
    const { button, events } = await setup();

    await act(async () => button()!.click());
    expect(events).toEqual([
      { kind: 'open', tileId: 'door', at: expect.any(Number) as number },
    ]);
  });

  it('is unavailable without its camera, and ignores taps', async () => {
    const { mock, button, tile, events } = await setup();

    await act(() => mock.controls.setUnavailable(CAMERA));
    expect(tile().textContent).toContain('Unavailable');
    expect(button()).toBeNull();
    expect(events).toEqual([]);
  });

  it('is unavailable while the doorbell is', async () => {
    const { mock, tile } = await setup();

    await act(() => mock.controls.setUnavailable(RING));
    expect(tile().textContent).toContain('Unavailable');
  });
});

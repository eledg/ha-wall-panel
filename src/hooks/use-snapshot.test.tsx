// @vitest-environment happy-dom
import type { Auth } from 'home-assistant-js-websocket';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { config } from '@/config/config.ts';
import { createHaStore } from '@/services/ha/store.ts';
import type { HaDeps } from '@/services/ha/store.ts';

import { shallowEqual, useSnapshot } from './use-snapshot.ts';

const setup = async () => {
  let push: (all: unknown) => void = () => {};
  const deps = {
    createConnection: vi
      .fn()
      .mockResolvedValue({ addEventListener: vi.fn(), close: vi.fn() }),
    subscribeEntities: vi.fn((_, cb) => {
      push = cb;
      return vi.fn();
    }),
    callService: vi.fn().mockResolvedValue({ response: {} }),
    fetchCalendarEvents: vi.fn().mockResolvedValue([]),
  };
  const store = createHaStore(deps as unknown as HaDeps);
  await act(async () => {
    await store.start(() => Promise.resolve({} as Auth));
  });
  return { store, push: (all: unknown) => act(() => push(all)) };
};

describe('useSnapshot', () => {
  afterEach(() => render(null, document.body));

  it('re-renders only when the selected part changes', async () => {
    const { store, push } = await setup();
    const renders = vi.fn();
    const Probe = () => {
      const light = useSnapshot(store, (s) => s.entities.officeLight?.state);
      renders(light);
      return <p>{light}</p>;
    };
    await act(() => render(<Probe />, document.body));
    renders.mockClear();

    await push({
      [config.entities.officeLight.id]: { state: 'on', attributes: {} },
    });
    expect(renders).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toBe('on');
    renders.mockClear();

    // A new entity object with the same state, and an unrelated entity.
    await push({
      [config.entities.officeLight.id]: { state: 'on', attributes: { a: 1 } },
      [config.entities.weather.id]: { state: 'sunny', attributes: {} },
    });
    expect(renders).not.toHaveBeenCalled();
  });

  it('compares array selections item by item', async () => {
    const { store, push } = await setup();
    const renders = vi.fn();
    const Probe = () => {
      const [light] = useSnapshot(store, (s) => [s.entities.officeLight]);
      renders(light);
      return null;
    };
    await act(() => render(<Probe />, document.body));
    // HA keeps the object of an entity that did not change.
    const light = { state: 'on', attributes: {} };
    await push({ [config.entities.officeLight.id]: light });
    renders.mockClear();

    await push({
      [config.entities.officeLight.id]: light,
      [config.entities.weather.id]: { state: 'x', attributes: {} },
    });
    expect(renders).not.toHaveBeenCalled();
  });

  it('follows the whole snapshot without a selector', async () => {
    const { store } = await setup();
    const Probe = () => <p>{useSnapshot(store).status}</p>;
    await act(() => render(<Probe />, document.body));

    expect(document.body.textContent).toBe('connected');
  });
});

describe('shallowEqual', () => {
  it('compares length and items', () => {
    expect(shallowEqual([1, 'a'], [1, 'a'])).toBe(true);
    expect(shallowEqual([1], [1, 2])).toBe(false);
    expect(shallowEqual([{}], [{}])).toBe(false);
  });
});

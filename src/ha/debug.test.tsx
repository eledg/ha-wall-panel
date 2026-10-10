// @vitest-environment happy-dom
import type { Auth } from 'home-assistant-js-websocket';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { describe, expect, it, vi } from 'vitest';

import { config } from '../config.ts';
import { HaDebug } from './debug.tsx';
import { createMockHa } from './mock.ts';
import { createHaStore } from './store.ts';
import type { HaDeps } from './store.ts';

describe('HaDebug', () => {
  it('shows live state and the subscription list', async () => {
    let push: (all: unknown) => void = () => {};
    const deps = {
      createConnection: vi
        .fn()
        .mockResolvedValue({ addEventListener: vi.fn(), close: vi.fn() }),
      subscribeEntities: vi.fn((_, cb) => {
        push = cb;
        return vi.fn();
      }),
      callService: vi.fn(),
    };
    const store = createHaStore(deps as unknown as HaDeps);
    await act(() => {
      render(<HaDebug store={store} />, document.body);
    });

    await act(async () => {
      await store.start(() => Promise.resolve({} as Auth));
      push({
        [config.entities.officeLight.id]: {
          state: 'on',
          attributes: {},
        },
      });
    });

    const text = document.body.textContent;
    expect(text).toContain('HA: connected');
    expect(text).toContain(`${config.entities.officeLight.id}: on`);
    expect(text).toContain(
      `Subscribed: ${config.entities.officeLight.id}, ${config.entities.officeIlluminance.id}, ${config.entities.weather.id}`,
    );
  });
});

describe('HaDebug with the mock', () => {
  it('drives the fake HA from its buttons', async () => {
    const mock = createMockHa();
    const store = createHaStore(mock.deps);
    const root = document.createElement('div');
    document.body.append(root);
    await act(() => {
      render(<HaDebug store={store} mock={mock.controls} />, root);
    });
    await act(async () => {
      await store.start(mock.getAuth);
    });
    const press = (label: string) =>
      act(() => {
        [...root.querySelectorAll('button')]
          .find((b) => b.textContent === label)!
          .click();
      });
    const light = config.entities.officeLight.id;

    expect(root.textContent).toContain('HA (mock): connected');
    expect(root.textContent).toContain(`${light}: off`);

    await press('HA flips light');
    expect(root.textContent).toContain(`${light}: on`);

    await press('Light unavailable');
    expect(root.textContent).toContain(`${light}: unavailable`);

    await press('Light back');
    expect(root.textContent).toContain(`${light}: off`);
  });
});

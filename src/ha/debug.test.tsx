// @vitest-environment happy-dom
import type { Auth } from 'home-assistant-js-websocket';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { describe, expect, it, vi } from 'vitest';

import { config } from '../config.ts';
import { HaDebug } from './debug.tsx';
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
    expect(text).not.toContain('Mock');
    expect(text).toContain('on');
    expect(text).toContain(`${Object.keys(config.entities).length} entities`);
  });
});

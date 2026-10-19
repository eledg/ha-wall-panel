// @vitest-environment happy-dom
import type { Auth } from 'home-assistant-js-websocket';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config/config.ts';
import { createHaStore } from '@/services/ha/store.ts';
import type { HaDeps } from '@/services/ha/store.ts';

import { HaDebug } from './ha-debug.tsx';

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
      callService: vi.fn().mockResolvedValue({ response: {} }),
      fetchCalendarEvents: vi.fn().mockResolvedValue([]),
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
        [config.entities.calendarFamily.id]: {
          state: 'off',
          attributes: {},
        },
      });
    });

    const text = document.body.textContent;
    expect(text).not.toContain('Mock');
    expect(text).toContain('on');
    expect(text).toContain('No event now');
    expect(text).toContain(`${Object.keys(config.entities).length} entities`);
  });

  it('lists entities alphabetically by ID', async () => {
    const deps = {
      createConnection: vi
        .fn()
        .mockResolvedValue({ addEventListener: vi.fn(), close: vi.fn() }),
      subscribeEntities: vi.fn(() => vi.fn()),
      callService: vi.fn().mockResolvedValue({ response: {} }),
      fetchCalendarEvents: vi.fn().mockResolvedValue([]),
    };
    const store = createHaStore(deps as unknown as HaDeps);
    await act(() => {
      render(<HaDebug store={store} />, document.body);
    });

    const ids = [...document.querySelectorAll('dt')].map(
      (dt) => dt.textContent,
    );

    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)));
    expect(ids).toHaveLength(Object.keys(config.entities).length);
  });
});

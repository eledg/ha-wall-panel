// @vitest-environment happy-dom
import type { Auth } from 'home-assistant-js-websocket';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { describe, expect, it } from 'vitest';

import { entityRefs } from '@/config/config.ts';
import { RING_UNAVAILABLE_MS } from '@/config/constants.ts';
import { createHaStore } from '@/services/ha/store.ts';
import { fakeHaDeps } from '@/tests/ha-deps.ts';
import { entityId } from '@/tests/ids.ts';

import { HaDebug } from './ha-debug.tsx';

describe('HaDebug', () => {
  it('shows live state and the subscription list', async () => {
    const { deps, push } = fakeHaDeps();
    const store = createHaStore(deps);
    await act(() => {
      render(<HaDebug store={store} />, document.body);
    });

    await act(async () => {
      await store.start(() => Promise.resolve({} as Auth));
      push({
        [entityId('light')]: {
          state: 'on',
          attributes: {},
        },
        [entityId('calendarFamily')]: {
          state: 'off',
          attributes: {},
        },
      });
    });

    const text = document.body.textContent;
    expect(text).not.toContain('Mock');
    expect(text).toContain('on');
    expect(text).toContain('No event now');
    expect(text).toContain(
      `${new Set(entityRefs().map(({ id }) => id)).size} entities`,
    );
  });

  it('lists entities alphabetically by ID', async () => {
    const { deps } = fakeHaDeps();
    const store = createHaStore(deps);
    await act(() => {
      render(<HaDebug store={store} />, document.body);
    });

    const ids = [...document.querySelectorAll('dt')].map(
      (dt) => dt.textContent,
    );

    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)));
    expect(ids).toHaveLength(new Set(entityRefs().map(({ id }) => id)).size);
  });

  it('flags a ring entity unavailable for more than a few minutes', async () => {
    const { deps, push } = fakeHaDeps();
    const store = createHaStore(deps);
    const changed = Date.parse('2026-01-01T12:00:00Z');
    let now = changed + RING_UNAVAILABLE_MS - 1_000;
    await act(() => {
      render(<HaDebug store={store} now={() => now} />, document.body);
    });
    await act(async () => {
      await store.start(() => Promise.resolve({} as Auth));
      push({
        [entityId('doorRing')]: {
          state: 'unavailable',
          attributes: {},
          last_changed: new Date(changed).toISOString(),
        },
      });
    });
    expect(document.body.textContent).not.toContain('Unavailable for');

    now = changed + 5 * 60_000;
    await act(() => {
      render(<HaDebug store={store} now={() => now} />, document.body);
    });
    expect(document.body.textContent).toContain('Unavailable for 5 min');
  });
});

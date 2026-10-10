// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { describe, expect, it } from 'vitest';

import { HaConnection, useOffline } from './connection.tsx';
import { createHaStore } from './store.ts';
import { createMockHa } from '../mock/engine.ts';

const Probe = () => <span>{useOffline() ? 'offline' : 'online'}</span>;

describe('HaConnection', () => {
  it('reports online outside a provider', () => {
    render(<Probe />, document.body);
    expect(document.body.textContent).toBe('online');
  });

  it('follows the store status', async () => {
    const mock = createMockHa();
    const store = createHaStore(mock.deps);
    await act(async () => {
      await store.start(mock.getAuth);
      render(
        <HaConnection store={store}>
          <Probe />
        </HaConnection>,
        document.body,
      );
    });
    expect(document.body.textContent).toBe('online');

    await act(() => mock.controls.setConnected(false));
    expect(document.body.textContent).toBe('offline');

    await act(() => mock.controls.setConnected(true));
    expect(document.body.textContent).toBe('online');
  });
});

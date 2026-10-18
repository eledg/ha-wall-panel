// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { describe, expect, it } from 'vitest';

import { createMockHa } from '@/dev/mock/engine.ts';
import { createHaStore } from '@/services/ha/store.ts';

import { DisconnectedBanner } from './disconnected-banner.tsx';

describe('DisconnectedBanner', () => {
  it('shows only while the connection is down', async () => {
    const mock = createMockHa();
    const store = createHaStore(mock.deps);
    await act(async () => {
      render(<DisconnectedBanner store={store} />, document.body);
    });
    expect(document.body.textContent).toBe('');

    await act(() => store.start(mock.getAuth));
    expect(document.body.textContent).toBe('');

    await act(() => mock.controls.setConnected(false));
    expect(document.body.textContent).toMatch(
      /Reconnecting… last updated \d\d:\d\d/,
    );

    await act(() => mock.controls.setConnected(true));
    expect(document.body.textContent).toBe('');
  });
});

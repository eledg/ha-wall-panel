// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it } from 'vitest';

import { HaConnection } from '@/components/layout/ha-connection.tsx';
import { createMockHa } from '@/dev/mock/engine.ts';
import { createHaStore } from '@/services/ha/store.ts';
import { entityId, tileOf } from '@/tests/ids.ts';

import { AcTile } from './ac-tile.tsx';

const AC = entityId('acClimate');

const setup = async (connect = true) => {
  const mock = createMockHa();
  const store = createHaStore(mock.deps);
  await act(async () => {
    if (connect) await store.start(mock.getAuth);
    render(
      <HaConnection store={store}>
        <AcTile tile={{ ...tileOf('ac'), label: 'Office AC' }} store={store} />
      </HaConnection>,
      document.body,
    );
  });
  const tile = () => document.querySelector('button');
  return { mock, store, tile };
};

afterEach(() => render(null, document.body));

describe('AcTile', () => {
  it('shows a skeleton before HA reports the AC', async () => {
    const { tile } = await setup(false);

    expect(tile()?.textContent).not.toContain('Off');
    expect(tile()?.querySelector('.bg-surface-2')).not.toBeNull();
  });

  it('shows Off while the AC is off', async () => {
    const { tile } = await setup();

    expect(tile()?.textContent).toContain('AC');
    expect(tile()?.textContent).toContain('Off');
    expect(tile()?.className).not.toContain('border-accent');
  });

  it('shows the target and mode while on', async () => {
    const { mock, tile } = await setup();

    await act(() => mock.controls.setState(AC, 'heat'));

    expect(tile()?.textContent).toContain('24.0°');
    expect(
      tile()?.querySelector('[role="img"]')?.getAttribute('aria-label'),
    ).toBe('Heat');
    expect(tile()?.className).toContain('border-accent');
  });

  it('shows an unavailable AC and cannot be opened', async () => {
    const { mock, tile } = await setup();

    await act(() => mock.controls.setUnavailable(AC));

    expect(document.body.textContent).toContain('Unavailable');
    expect(tile()).toBeNull();
  });

  it('opens and closes the control sheet', async () => {
    const { tile } = await setup();

    await act(() => tile()!.click());
    const dialog = document.querySelector('dialog');
    expect(dialog?.textContent).toContain('Office AC');

    await act(() =>
      (document.querySelector('[aria-label="Close"]') as HTMLElement).click(),
    );
    expect(document.querySelector('dialog')).toBeNull();
  });

  it('goes stale while disconnected', async () => {
    const { mock, tile } = await setup();

    await act(() => mock.controls.setConnected(false));

    expect(document.body.textContent).toContain('stale');
    expect(tile()?.disabled).toBe(true);
  });
});

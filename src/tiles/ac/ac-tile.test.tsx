// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it } from 'vitest';

import { AcTile } from './ac-tile.tsx';
import { config } from '../../config.ts';
import { HaConnection } from '../../ha/connection.tsx';
import { createHaStore } from '../../ha/store.ts';
import { createMockHa } from '../../mock/engine.ts';

const AC = config.entities.acClimate.id;

const setup = async (connect = true) => {
  const mock = createMockHa();
  const store = createHaStore(mock.deps);
  await act(async () => {
    if (connect) await store.start(mock.getAuth);
    render(
      <HaConnection store={store}>
        <AcTile area="ac" store={store} />
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
    expect(tile()?.textContent).toContain('Heat');
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
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-label')).toBe('Office air conditioning');

    await act(() =>
      (document.querySelector('[aria-label="Close"]') as HTMLElement).click(),
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('goes stale while disconnected', async () => {
    const { mock, tile } = await setup();

    await act(() => mock.controls.setConnected(false));

    expect(document.body.textContent).toContain('stale');
    expect(tile()?.disabled).toBe(true);
  });
});

// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it } from 'vitest';

import { HaConnection } from '@/components/layout/ha-connection.tsx';
import { config } from '@/config/config.ts';
import { createMockHa } from '@/dev/mock/engine.ts';
import { createHaStore } from '@/services/ha/store.ts';

import { HeatingTile } from './heating-tile.tsx';

const CLIMATE = config.entities.heatingClimate.id;
const CLOUD = config.entities.heatingCloud.id;

const setup = async (connect = true) => {
  const mock = createMockHa();
  const store = createHaStore(mock.deps);
  await act(async () => {
    if (connect) await store.start(mock.getAuth);
    render(
      <HaConnection store={store}>
        <HeatingTile area="heat" store={store} />
      </HaConnection>,
      document.body,
    );
  });
  const tile = () => document.querySelector('button');
  const waves = () =>
    tile()?.querySelector('svg[role="img"]')?.getAttribute('aria-label');
  const filled = () =>
    tile()?.querySelector('svg[role="img"] path')?.getAttribute('fill');
  return { mock, store, tile, waves, filled };
};

afterEach(() => render(null, document.body));

describe('HeatingTile', () => {
  it('shows a skeleton before HA reports the heating', async () => {
    const { tile } = await setup(false);

    expect(tile()?.textContent).not.toContain('Schedule');
    expect(tile()?.querySelector('.bg-surface-2')).not.toBeNull();
  });

  it('shows the target and no humidity, labelled Heating', async () => {
    const { tile } = await setup();

    expect(tile()?.textContent).toContain('Heating');
    expect(tile()?.textContent).toContain('20.0°');
    expect(tile()?.textContent).not.toContain('%');
    expect(tile()?.querySelector('path[d^="M12 3s6"]')).toBeNull();
  });

  it('is lit amber and says Schedule while following the schedule', async () => {
    const { tile } = await setup();

    expect(tile()?.textContent).toContain('Schedule');
    expect(tile()?.className).toContain('border-accent');
  });

  it('is red and says Manual with a manual target', async () => {
    const { mock, tile } = await setup();
    await act(() => mock.controls.setHeating('manual'));

    expect(tile()?.textContent).toContain('Manual');
    expect(tile()?.textContent).toContain('20.5°');
    expect(tile()?.className).toContain('border-heating-manual');
    expect(tile()?.className).not.toContain('border-accent');
  });

  it('is muted, with no status, when turned off', async () => {
    const { mock, tile } = await setup();
    await act(() => mock.controls.setHeating('off'));

    expect(tile()?.className).not.toContain('border-accent');
    expect(tile()?.className).not.toContain('border-heating-manual');
    expect(tile()?.textContent).not.toContain('Paused');
    expect(tile()?.textContent).not.toContain('Schedule');
    expect(tile()?.textContent).toContain('Off');
    expect(tile()?.textContent).not.toContain('°');
  });

  it('is muted, with a pause icon and "Paused", when paused', async () => {
    const { mock, tile } = await setup();
    await act(() => mock.controls.setHeating('paused'));

    expect(tile()?.className).not.toContain('border-accent');
    expect(tile()?.textContent).toContain('Paused');
    expect(tile()?.textContent).toContain('Off');
    expect(tile()?.querySelector('rect')).not.toBeNull();
  });

  it('fills the heat waves with demand and outlines them without, in every state', async () => {
    const { mock, waves, filled } = await setup();

    for (const state of ['schedule', 'manual', 'off', 'paused'] as const) {
      await act(() => mock.controls.setHeating(state));
      await act(() => mock.controls.setHeatingDemand(true));
      expect(waves(), state).toBe('Calling for heat');
      expect(filled(), state).toBe('currentColor');
      await act(() => mock.controls.setHeatingDemand(false));
      expect(waves(), state).toBe('No heating demand');
      expect(filled(), state).toBe('none');
    }
  });

  it('shows an unavailable climate entity and cannot be opened', async () => {
    const { mock, tile } = await setup();
    await act(() => mock.controls.setUnavailable(CLIMATE));

    expect(document.body.textContent).toContain('Unavailable');
    expect(tile()).toBeNull();
  });

  it('is unavailable when the Tado cloud connection is lost', async () => {
    const { mock, tile } = await setup();
    await act(() => mock.controls.setState(CLOUD, 'off', {}));

    expect(document.body.textContent).toContain('Unavailable');
    expect(tile()).toBeNull();
  });

  it('is stale while HA is disconnected', async () => {
    const { mock, tile } = await setup();
    await act(() => mock.controls.setConnected(false));

    expect(tile()?.textContent).toContain('stale');
  });

  it('opens the sheet when tapped', async () => {
    const { tile } = await setup();
    await act(() => tile()?.click());

    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Central heating');
  });
});

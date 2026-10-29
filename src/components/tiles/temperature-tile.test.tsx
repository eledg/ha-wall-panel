// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it } from 'vitest';

import { HaConnection } from '@/components/layout/ha-connection.tsx';
import { createMockHa } from '@/dev/mock/engine.ts';
import { createHaStore } from '@/services/ha/store.ts';
import { entityId, tileOf } from '@/tests/ids.ts';

import { TemperatureTile } from './temperature-tile.tsx';

const TEMP = entityId('roomTemperature');
const HUMIDITY = entityId('roomHumidity');

const setup = async (connect = true) => {
  const mock = createMockHa();
  const store = createHaStore(mock.deps);
  await act(async () => {
    if (connect) await store.start(mock.getAuth);
    render(
      <HaConnection store={store}>
        <TemperatureTile tile={tileOf('temperature')} store={store} />
      </HaConnection>,
      document.body,
    );
  });
  return { mock };
};

afterEach(() => render(null, document.body));

describe('TemperatureTile', () => {
  it('shows a skeleton before HA reports the entity', async () => {
    await setup(false);

    expect(document.body.textContent).not.toContain('Office');
    expect(document.querySelector('.bg-surface-2')).not.toBeNull();
  });

  it('shows the temperature to one decimal', async () => {
    await setup();

    expect(document.body.textContent).toContain('Office');
    expect(document.body.textContent).toContain('22.2°');
  });

  it('shows the humidity as a whole percent', async () => {
    await setup();

    expect(document.body.textContent).toContain('51%');
  });

  it('follows changes', async () => {
    const { mock } = await setup();

    await act(() => {
      mock.controls.setState(TEMP, '21.4');
      mock.controls.setState(HUMIDITY, '47.2');
    });

    expect(document.body.textContent).toContain('21.4°');
    expect(document.body.textContent).toContain('47%');
  });

  it('shows n/a when the temperature is unavailable', async () => {
    const { mock } = await setup();

    await act(() => mock.controls.setUnavailable(TEMP));

    expect(document.body.textContent).toContain('n/a');
    expect(document.body.textContent).not.toContain('°');
  });

  it('keeps the temperature when only the humidity is unavailable', async () => {
    const { mock } = await setup();

    await act(() => mock.controls.setUnavailable(HUMIDITY));

    expect(document.body.textContent).toContain('22.2°');
    expect(document.body.textContent).not.toContain('%');
    expect(document.body.textContent).not.toContain('n/a');
  });

  it('goes stale while disconnected', async () => {
    const { mock } = await setup();

    await act(() => mock.controls.setConnected(false));

    expect(document.body.textContent).toContain('stale');
  });

  describe('the climate sheet', () => {
    const tap = () =>
      act(() => {
        document.querySelector<HTMLButtonElement>('button')!.click();
      });
    const press = (name: string) =>
      act(() => {
        [...document.querySelectorAll('button')]
          .find((b) => b.textContent?.includes(name))!
          .click();
      });

    it('opens when the tile is tapped and closes with Close', async () => {
      await setup();
      expect(document.querySelector('dialog')).toBeNull();

      await tap();
      expect(document.body.textContent).toContain('Office climate');

      await act(() => {
        document
          .querySelector<HTMLButtonElement>('[aria-label="Close"]')!
          .click();
      });
      expect(document.querySelector('dialog')).toBeNull();
    });

    it('swaps to the heating sheet and the AC sheet from its shortcuts', async () => {
      await setup();

      await tap();
      await press('Central heating');
      expect(document.body.textContent).not.toContain('Office climate');
      expect(document.body.textContent).toContain('Following schedule');

      await act(() => {
        document
          .querySelector<HTMLButtonElement>('[aria-label="Close"]')!
          .click();
      });
      await tap();
      await press('AC');
      expect(document.body.textContent).toContain('AC off');
    });

    it('still opens when the sensor is unavailable, and says so', async () => {
      const { mock } = await setup();

      await act(() => mock.controls.setUnavailable(TEMP));
      await tap();

      expect(document.body.textContent).toContain('Office unavailable');
    });
  });
});

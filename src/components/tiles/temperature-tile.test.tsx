// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it } from 'vitest';

import { HaConnection } from '@/components/layout/ha-connection.tsx';
import { config } from '@/config/config.ts';
import { createMockHa } from '@/dev/mock/engine.ts';
import { createHaStore } from '@/services/ha/store.ts';

import { TemperatureTile } from './temperature-tile.tsx';

const TEMP = config.entities.officeTemperature.id;
const HUMIDITY = config.entities.officeHumidity.id;

const setup = async (connect = true) => {
  const mock = createMockHa();
  const store = createHaStore(mock.deps);
  await act(async () => {
    if (connect) await store.start(mock.getAuth);
    render(
      <HaConnection store={store}>
        <TemperatureTile area="temp" store={store} />
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
});

// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HaConnection } from '@/components/layout/ha-connection.tsx';
import { createMockHa } from '@/dev/mock/engine.ts';
import { createHaStore } from '@/services/ha/store.ts';
import { expectConsole } from '@/tests/console.ts';
import { entityId, tileOf } from '@/tests/ids.ts';

import { HISTORY_REFRESH_MS, RoomSheet } from './room-sheet.tsx';

const setup = async ({
  linked = true,
  failHistory = false,
  connect = true,
}: { linked?: boolean; failHistory?: boolean; connect?: boolean } = {}) => {
  const mock = createMockHa();
  mock.controls.failHistory(failHistory);
  const store = createHaStore(mock.deps);
  const onClose = vi.fn();
  const onOpenHeating = vi.fn();
  const onOpenAc = vi.fn();
  await act(async () => {
    if (connect) await store.start(mock.getAuth);
    render(
      <HaConnection store={store}>
        <RoomSheet
          tile={tileOf('temperature')}
          heatingTile={linked ? tileOf('heating') : undefined}
          acTile={linked ? tileOf('ac') : undefined}
          store={store}
          onClose={onClose}
          onOpenHeating={onOpenHeating}
          onOpenAc={onOpenAc}
          idleMs={30_000}
        />
      </HaConnection>,
      document.body,
    );
    // The history is read through a few chained promises and a timer.
    for (let i = 0; i < 3; i++) {
      if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(0);
      else await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
  const button = (name: string) =>
    [...document.querySelectorAll('button')].find(
      (b) =>
        b.textContent?.includes(name) || b.getAttribute('aria-label') === name,
    );
  return { mock, store, onClose, onOpenHeating, onOpenAc, button };
};

afterEach(() => {
  vi.useRealTimers();
  render(null, document.body);
});

describe('RoomSheet', () => {
  it('shows the title and a status line with the temperature, humidity and feel', async () => {
    await setup();

    expect(document.body.textContent).toContain('Office climate');
    expect(document.body.textContent).toContain(
      '22.2° · 51% humidity · Comfortable',
    );
    expect(document.body.textContent).toContain('Office now');
  });

  it('draws the six hour chart with its range summary and time labels', async () => {
    await setup();

    expect(
      document.querySelector('[aria-label="Climate over the last 6 hours"]'),
    ).not.toBeNull();
    expect(document.querySelectorAll('.stroke-fg')).toHaveLength(1);
    expect(document.querySelectorAll('.stroke-humidity')).toHaveLength(1);
    expect(document.body.textContent).toMatch(
      /6h: \d+\.\d°–\d+\.\d° · \d+–\d+%/,
    );
  });

  it('shows the heating and AC with their state, and shades their runs', async () => {
    await setup();

    expect(document.body.textContent).toContain('Central heating');
    expect(document.body.textContent).toContain('Target 20.0° · heating');
    expect(document.body.textContent).toContain('AC');
    expect(document.body.textContent).toContain('Off');
    expect(document.querySelectorAll('rect.fill-accent-soft')).toHaveLength(4);
    expect(document.querySelectorAll('rect.fill-cool-soft')).toHaveLength(2);
  });

  it('opens the heating and AC sheets from their buttons', async () => {
    const { button, onOpenHeating, onOpenAc } = await setup();

    await act(() => button('Central heating')!.click());
    await act(() => button('AC')!.click());

    expect(onOpenHeating).toHaveBeenCalledOnce();
    expect(onOpenAc).toHaveBeenCalledOnce();
  });

  it('has no shortcuts or bands without heating and AC tiles', async () => {
    const { button } = await setup({ linked: false });

    expect(button('Central heating')).toBeUndefined();
    expect(document.body.textContent).not.toContain('Heating');
    expect(document.querySelectorAll('rect')).toHaveLength(0);
  });

  it('closes with the Close button', async () => {
    const { button, onClose } = await setup();

    await act(() => button('Close')!.click());

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows the empty state when the history cannot be read', async () => {
    const error = expectConsole();
    await setup({ failHistory: true });

    expect(document.body.textContent).toContain('No climate history available');
    expect(error.length).toBeGreaterThan(0);
  });

  it('says so when the room sensor is unavailable', async () => {
    const { mock } = await setup();

    await act(() =>
      mock.controls.setState(entityId('roomTemperature'), 'unavailable'),
    );

    expect(document.body.textContent).toContain('Office unavailable');
  });

  it('follows live readings and flags an uncomfortable room', async () => {
    const { mock } = await setup();

    await act(() => mock.controls.setState(entityId('roomHumidity'), '70'));

    expect(document.body.textContent).toContain('70% humidity · Humid');
  });

  it('refreshes the history while open and keeps it if a refresh fails', async () => {
    vi.useFakeTimers();
    const error = expectConsole();
    const { mock } = await setup();
    const chart = () =>
      document.querySelector('[aria-label="Climate over the last 6 hours"]');
    expect(chart()?.querySelector('svg')).not.toBeNull();

    mock.controls.failHistory(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(HISTORY_REFRESH_MS);
    });

    expect(chart()?.querySelector('svg')).not.toBeNull();
    expect(error.length).toBeGreaterThan(0);
  });
});

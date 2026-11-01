// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HaConnection } from '@/components/layout/ha-connection.tsx';
import type { WeatherDetailsConfig } from '@/config/config.ts';
import { createMockHa } from '@/dev/mock/engine.ts';
import { createHaStore } from '@/services/ha/store.ts';
import { entityId, tileOf } from '@/tests/ids.ts';

import { WEATHER_MAX_AGE_MS, WeatherSheet } from './weather-sheet.tsx';

const id = entityId('weather');
const text = () => document.body.textContent;

const setup = async ({
  scenario,
  tile = tileOf('weather'),
  onClose = vi.fn(),
  idleMs = 30_000,
}: {
  scenario?: string;
  tile?: ReturnType<typeof tileOf<'weather'>>;
  onClose?: () => void;
  idleMs?: number;
} = {}) => {
  const mock = createMockHa();
  if (scenario) mock.controls.setWeather(scenario);
  const store = createHaStore(mock.deps);
  const refresh = vi.spyOn(store, 'refreshWeather');
  await act(async () => {
    await store.start(mock.getAuth);
  });
  const show = () =>
    act(() => {
      render(
        <HaConnection store={store}>
          <WeatherSheet
            tile={tile}
            store={store}
            onClose={onClose}
            idleMs={idleMs}
          />
        </HaConnection>,
        document.body,
      );
    });
  await show();
  return { mock, store, refresh, onClose };
};

afterEach(() => {
  vi.useRealTimers();
  render(null, document.body);
});

describe('WeatherSheet', () => {
  it('shows the current conditions and the figures behind them', async () => {
    await setup();

    expect(text()).toContain('Weather');
    expect(text()).toContain('Sunny');
    expect(text()).toContain('11°');
    for (const label of [
      'Feels like',
      'Humidity',
      'Wind',
      'UV index',
      'Pressure',
      'Visibility',
      'Dew point',
      'Sunrise',
      'Sunset',
    ]) {
      expect(text()).toContain(label);
    }
    // HA's own units, rounded: km/h and a compass point, not mph.
    expect(text()).toContain('39 km/h');
    expect(text()).toContain('gusts 40');
    expect(text()).toContain('1013 hPa');
    expect(text()).toContain('23 km');
    expect(text()).toContain('57%');
    expect(text()).toMatch(/H \d+° L \d+°/);
  });

  it('shows five hours ahead and the week', async () => {
    await setup();

    expect(document.querySelector('[aria-label="Next hours"]')).not.toBeNull();
    expect(text()).toContain('Today');
    expect(
      document.querySelectorAll('[aria-label="7-day outlook"] li'),
    ).toHaveLength(7);
    expect(
      document.querySelectorAll('[aria-label="Next hours"] .grid > div'),
    ).toHaveLength(5);
  });

  it('shows rain in mm only for hours that report some', async () => {
    await setup();
    expect(text()).not.toContain(' mm');

    await act(async () => render(null, document.body));
    await setup({ scenario: 'rainy' });
    expect(text()).toContain('0.8 mm');
  });

  it('hides every figure the entity does not report', async () => {
    await setup({ scenario: 'sparse' });

    expect(text()).toContain('9°');
    for (const label of [
      'Feels like',
      'Humidity',
      'Wind',
      'UV index',
      'Pressure',
      'Visibility',
      'Dew point',
    ]) {
      expect(text()).not.toContain(label);
    }
  });

  it('hides sunrise and sunset without a sun entity', async () => {
    const tile = tileOf('weather');
    await setup({
      tile: { ...tile, entities: { entity: tile.entities.entity } },
    });

    expect(text()).toContain('Humidity');
    expect(text()).not.toContain('Sunrise');
    expect(text()).not.toContain('Sunset');
  });

  it.each([
    ['hourly-only', true, false],
    ['daily-only', false, true],
    ['no-forecast', false, false],
  ])('with %s shows hours: %s, days: %s', async (scenario, hours, days) => {
    await setup({ scenario });

    expect(document.querySelector('[aria-label="Next hours"]') !== null).toBe(
      hours,
    );
    expect(
      document.querySelector('[aria-label="7-day outlook"]') !== null,
    ).toBe(days);
    expect(text()).toContain('Humidity');
  });

  it('copes with missing conditions and temperatures in the forecast', async () => {
    await setup({ scenario: 'odd-data' });

    expect(text()).toContain('Exceptional');
    expect(text()).toContain('–');
  });

  it('refreshes stale forecasts when it opens', async () => {
    const { refresh } = await setup();

    expect(refresh).toHaveBeenCalledWith(id, WEATHER_MAX_AGE_MS);
  });

  it('follows the entity while open', async () => {
    const { mock } = await setup();

    await act(async () =>
      mock.controls.setState(id, 'rainy', { temperature: 7 }),
    );

    expect(text()).toContain('7°');
    expect(text()).toContain('Rain');
  });

  it('says so when the entity becomes unavailable', async () => {
    const { mock } = await setup();

    await act(async () => mock.controls.setUnavailable(id));

    expect(text()).toContain('Weather unavailable');
    expect(text()).not.toContain('Humidity');
  });

  it('marks the data stale while HA is unreachable', async () => {
    const { mock } = await setup();

    await act(async () => mock.controls.setConnected(false));

    expect(text()).toContain('stale, last updated');
    expect(text()).toContain('11°');
  });

  describe('configured by the tile', () => {
    const configured = (details: Partial<WeatherDetailsConfig>) => {
      const tile = tileOf('weather');
      return { tile: { ...tile, details: { ...tile.details, ...details } } };
    };
    const outlookDays = () =>
      document.querySelectorAll('[aria-label$="-day outlook"] li');
    const hourLabels = () =>
      [
        ...document.querySelectorAll(
          '[aria-label="Next hours"] .grid > div > span:first-child',
        ),
      ].map((el) => Number(el.textContent!.slice(0, 2)));

    it('shows only the days asked for, and says how many', async () => {
      await setup(configured({ days: 3 }));

      expect(outlookDays()).toHaveLength(3);
      expect(
        document.querySelector('[aria-label="3-day outlook"]'),
      ).not.toBeNull();
    });

    it('hides the outlook at 0 days and the hours at 0 columns', async () => {
      await setup(configured({ days: 0 }));
      expect(outlookDays()).toHaveLength(0);
      expect(hourLabels()).toHaveLength(5);

      await act(async () => render(null, document.body));
      await setup(configured({ hoursCount: 0 }));
      expect(hourLabels()).toHaveLength(0);
      expect(outlookDays()).toHaveLength(7);
    });

    it('spaces the hourly columns by hoursStep', async () => {
      await setup(configured({ hoursStep: 6, hoursCount: 3 }));

      const [first, second, third] = hourLabels();
      expect(hourLabels()).toHaveLength(3);
      expect((second! - first! + 24) % 24).toBe(6);
      expect((third! - second! + 24) % 24).toBe(6);
    });

    it('shows the stats listed, in that order, and no others', async () => {
      await setup(configured({ stats: ['sunset', 'humidity', 'wind'] }));
      const at = (label: string) => text()!.indexOf(label);

      expect(at('Sunset')).toBeGreaterThan(-1);
      expect(at('Sunset')).toBeLessThan(at('Humidity'));
      expect(at('Humidity')).toBeLessThan(at('Wind'));
      for (const hidden of ['Feels like', 'UV index', 'Pressure', 'Sunrise']) {
        expect(text()).not.toContain(hidden);
      }
    });

    it('leaves out the stats block when none are listed', async () => {
      await setup(configured({ stats: [] }));

      expect(text()).not.toContain('Humidity');
      expect(text()).toContain('11°');
      expect(
        document.querySelector('[aria-label="Next hours"]'),
      ).not.toBeNull();
    });

    it('still hides a listed stat the source does not report', async () => {
      await setup({
        scenario: 'sparse',
        ...configured({ stats: ['wind', 'sunrise'] }),
      });

      expect(text()).not.toContain('Wind');
      expect(text()).toContain('Sunrise');
    });
  });

  describe('closing', () => {
    it('closes from the Close button', async () => {
      const { onClose } = await setup();

      await act(() =>
        document
          .querySelector<HTMLButtonElement>('[aria-label="Close"]')!
          .click(),
      );

      expect(onClose).toHaveBeenCalled();
    });

    it('closes on Escape', async () => {
      const { onClose } = await setup();

      await act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });

      expect(onClose).toHaveBeenCalled();
    });

    it('closes after the idle time, restarted by a touch', async () => {
      vi.useFakeTimers();
      const { onClose } = await setup({ idleMs: 1000 });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(800);
      });
      await act(() => {
        document
          .querySelector('dialog')!
          .dispatchEvent(new Event('pointerdown', { bubbles: true }));
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(800);
      });
      expect(onClose).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});

describe('weather warnings', () => {
  const control = () =>
    document.body.querySelector<HTMLButtonElement>('[aria-label^="View "]');
  const details = () =>
    document.body.querySelector(
      'dialog[aria-labelledby="weather-alert-title"]',
    );
  const press = (key: string) =>
    act(() => {
      (document.activeElement ?? document.body).dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true }),
      );
    });

  it('has no control without warnings', async () => {
    await setup();

    expect(control()).toBeNull();
  });

  it('opens the details from the header control', async () => {
    const { mock } = await setup();
    await act(async () => mock.controls.setWarnings('multiple'));

    expect(control()?.getAttribute('aria-label')).toBe(
      'View amber warning: Rain',
    );
    expect(control()?.textContent).toContain('Amber warning: Rain +1');
    await act(() => control()?.click());

    expect(details()).not.toBeNull();
    expect(text()).toContain('Weather warnings');
    expect(text()).toContain('Heavy rain');
    expect(text()).toContain('Yellow warning: Strong winds');
    expect(text()).toContain('Active');
    expect(text()).toContain('Berkhamsted');
  });

  it('closes only the details on Escape', async () => {
    const { mock, onClose } = await setup();
    await act(async () => mock.controls.setWarnings('yellow'));
    await act(() => control()?.click());

    await press('Escape');

    expect(details()).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(text()).toContain('Weather');
  });

  it('closes the details with its Close button', async () => {
    const { mock, onClose } = await setup();
    await act(async () => mock.controls.setWarnings('red'));
    await act(() => control()?.click());

    await act(() =>
      document.body
        .querySelector<HTMLButtonElement>(
          '[aria-label="Close warning details"]',
        )
        ?.click(),
    );

    expect(details()).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes the details when the warnings end', async () => {
    const { mock } = await setup();
    await act(async () => mock.controls.setWarnings('red'));
    await act(() => control()?.click());

    await act(async () => mock.controls.setWarnings('none'));

    expect(details()).toBeNull();
    expect(control()).toBeNull();
  });

  it('counts a touch inside the details as activity', async () => {
    vi.useFakeTimers();
    const { mock, onClose } = await setup({ idleMs: 1000 });
    await act(async () => mock.controls.setWarnings('yellow'));
    await act(() => control()?.click());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    await act(() => {
      details()!
        .querySelector('section')!
        .dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('returns focus to the header control each time the details close', async () => {
    const { mock } = await setup();
    await act(async () => mock.controls.setWarnings('yellow'));

    for (let round = 0; round < 2; round++) {
      control()!.focus();
      await act(() => control()?.click());
      expect(document.activeElement?.getAttribute('aria-label')).toBe(
        'Close warning details',
      );

      await press('Escape');

      expect(details()).toBeNull();
      expect(document.activeElement).toBe(control());
    }
  });
});

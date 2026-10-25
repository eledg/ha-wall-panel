// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HaConnection } from '@/components/layout/ha-connection.tsx';
import { createMockHa } from '@/dev/mock/engine.ts';
import type { MockHeatingState } from '@/dev/mock/scenarios/heating.ts';
import { TARGET_DEBOUNCE_MS } from '@/hooks/use-climate-commands.ts';
import { createHaStore } from '@/services/ha/store.ts';
import { expectConsole } from '@/tests/console.ts';
import { entityId, tileOf } from '@/tests/ids.ts';

import { HeatingSheet, PRESS_MS } from './heating-sheet.tsx';

const CLIMATE = entityId('heatingClimate');
const SCHEDULE = entityId('heatingSchedule');

const setup = async ({
  state = 'schedule',
  onClose = vi.fn(),
  roomLabel = tileOf('heating').roomLabel,
}: {
  state?: MockHeatingState;
  onClose?: () => void;
  roomLabel?: string;
} = {}) => {
  const mock = createMockHa();
  const store = createHaStore(mock.deps);
  const spy = vi.spyOn(store, 'callService');
  await act(async () => {
    await store.start(mock.getAuth);
    mock.controls.setHeating(state);
    render(
      <HaConnection store={store}>
        <HeatingSheet
          tile={{ ...tileOf('heating'), roomLabel }}
          store={store}
          onClose={onClose}
          idleMs={30_000}
        />
      </HaConnection>,
      document.body,
    );
  });
  const button = (name: string) =>
    [...document.querySelectorAll('button')].find(
      (b) =>
        b.textContent?.includes(name) || b.getAttribute('aria-label') === name,
    )! as HTMLButtonElement;
  const press = (name: string) => act(() => button(name).click());
  return { mock, store, spy, button, press, onClose };
};

afterEach(() => {
  vi.useRealTimers();
  render(null, document.body);
});

describe('HeatingSheet', () => {
  it('names the room in the current-temperature caption', async () => {
    await setup({ roomLabel: 'Study' });

    expect(document.body.textContent).toContain('Study now');
    expect(document.body.textContent).not.toContain('Living room now');
  });

  it('shows the status, room temperature and target', async () => {
    await setup();
    const text = document.body.textContent;

    expect(text).toContain('Central heating');
    expect(text).toContain('Following schedule');
    expect(text).toContain('Living room now');
    expect(text).toContain('19.9°');
    expect(text).toContain('20.0°');
    expect(text).not.toMatch(/zone/i);
  });

  it('shows the paused line, with no countdown, and an unlit power button', async () => {
    const { button } = await setup({ state: 'paused' });

    expect(document.body.textContent).toContain(
      'Heating paused. It will resume automatically.',
    );
    expect(document.body.textContent).not.toMatch(/\d+ ?min/);
    expect(button('Heating power').getAttribute('aria-pressed')).toBe('false');
  });

  describe('power', () => {
    it('lights the power button when on and unlights it in Off and Paused', async () => {
      const { mock, button } = await setup();
      expect(button('Heating power').getAttribute('aria-pressed')).toBe('true');
      expect(button('Heating power').className).toContain('bg-accent!');

      for (const state of ['off', 'paused'] as const) {
        await act(() => mock.controls.setHeating(state));
        expect(button('Heating power').getAttribute('aria-pressed')).toBe(
          'false',
        );
        expect(button('Heating power').className).not.toContain('bg-accent!');
      }
    });

    it('turns heating off without closing, and keeps the sheet readable', async () => {
      const { spy, press, mock, onClose } = await setup();

      await press('Heating power');

      expect(spy).toHaveBeenLastCalledWith(
        'climate',
        CLIMATE,
        'set_hvac_mode',
        {
          hvac_mode: 'off',
        },
      );
      expect(mock.controls.getHeating()).toBe('off');
      expect(onClose).not.toHaveBeenCalled();
      expect(document.body.textContent).toContain('Heating off');
    });

    it('turns heating on from Off', async () => {
      const { spy, press } = await setup({ state: 'off' });

      await press('Heating power');

      expect(spy).toHaveBeenLastCalledWith(
        'climate',
        CLIMATE,
        'set_hvac_mode',
        {
          hvac_mode: 'heat',
        },
      );
    });
  });

  describe('target', () => {
    it('steps at once and sends one call after the taps pause', async () => {
      vi.useFakeTimers();
      const { spy, press } = await setup();

      await press('Raise');
      await press('Raise');
      await press('Lower');
      expect(document.body.textContent).toContain('20.5°');
      expect(spy).not.toHaveBeenCalled();

      await act(() => {
        vi.advanceTimersByTime(TARGET_DEBOUNCE_MS);
      });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('climate', CLIMATE, 'set_temperature', {
        temperature: 20.5,
      });
    });

    it('makes the heating manual once the target changes', async () => {
      vi.useFakeTimers();
      const { mock, press } = await setup();

      await press('Raise');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(TARGET_DEBOUNCE_MS);
      });

      expect(mock.controls.getHeating()).toBe('manual');
      expect(document.body.textContent).toContain('Manual target');
    });

    it('stops at 5 and 30', async () => {
      const { mock, button } = await setup();

      await act(() =>
        mock.controls.setState(CLIMATE, 'heat', {
          ...mock.controls.getState(CLIMATE)?.attributes,
          temperature: 30,
        }),
      );
      expect(button('Raise').disabled).toBe(true);
      expect(button('Lower').disabled).toBe(false);

      await act(() =>
        mock.controls.setState(CLIMATE, 'heat', {
          ...mock.controls.getState(CLIMATE)?.attributes,
          temperature: 5,
        }),
      );
      expect(button('Lower').disabled).toBe(true);
    });

    it('is disabled when heating is off or paused', async () => {
      const { mock, button } = await setup();

      for (const state of ['off', 'paused'] as const) {
        await act(() => mock.controls.setHeating(state));
        expect(button('Raise').disabled, state).toBe(true);
        expect(button('Lower').disabled, state).toBe(true);
      }
    });
  });

  describe('Resume schedule and Boost', () => {
    it.each([
      ['schedule', false, true],
      ['manual', true, true],
      ['off', true, false],
      ['paused', false, false],
    ] as const)(
      '%s: resume enabled %s, boost enabled %s',
      async (state, resume, boost) => {
        const { button } = await setup({ state });

        expect(button('Resume schedule').disabled).toBe(!resume);
        expect(button('Boost').disabled).toBe(!boost);
      },
    );

    it('disables both, clearly, when unavailable', async () => {
      const { mock, button } = await setup({ state: 'manual' });

      await act(() => mock.controls.setUnavailable(CLIMATE));

      expect(button('Resume schedule').disabled).toBe(true);
      expect(button('Boost').disabled).toBe(true);
      expect(button('Resume schedule').className).toContain(
        'disabled:opacity-30',
      );
    });

    it('resumes the schedule and shows a short pending state', async () => {
      vi.useFakeTimers();
      const { spy, press, button, mock } = await setup({ state: 'manual' });

      await press('Resume schedule');

      expect(spy).toHaveBeenLastCalledWith(
        'button',
        entityId('heatingResume'),
        'press',
      );
      expect(mock.controls.getHeating()).toBe('schedule');
      expect(button('Resume schedule').getAttribute('aria-busy')).toBe('true');
      expect(button('Boost').disabled).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(PRESS_MS);
      });
      expect(button('Resume schedule').getAttribute('aria-busy')).toBe('false');
    });

    it('boosts, shows no state or countdown, and settles', async () => {
      vi.useFakeTimers();
      const { spy, press, button } = await setup();

      await press('Boost');

      expect(spy).toHaveBeenLastCalledWith(
        'button',
        entityId('heatingBoost'),
        'press',
      );
      expect(button('Boost').getAttribute('aria-busy')).toBe('true');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PRESS_MS);
      });
      expect(button('Boost').getAttribute('aria-busy')).toBe('false');
      expect(document.body.textContent).not.toMatch(/boost(ing|ed)/i);
    });
  });

  describe('when calls fail', () => {
    it('flashes the control that failed and reverts', async () => {
      vi.useFakeTimers();
      const error = expectConsole();
      const { mock, press, button } = await setup();
      mock.controls.failServices(true);

      await press('Heating power');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(button('Heating power').className).toContain('bg-warn-soft');
      expect(button('Heating power').getAttribute('aria-pressed')).toBe('true');

      await press('Boost');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(button('Boost').className).toContain('bg-warn-soft');
      expect(error).toHaveLength(2);
    });
  });

  describe('demand history', () => {
    it('draws four heating periods with 24h labels', async () => {
      await setup();
      await act(async () => {});
      const section = document.querySelector(
        '[aria-label="Heating demand history"]',
      )!;

      expect(section.textContent).toContain('last 6 hours');
      expect(
        section.querySelector('[role="img"]')?.getAttribute('aria-label'),
      ).toBe('4 heating periods over the last 6 hours');
      expect(section.querySelectorAll('.bg-accent')).toHaveLength(5); // 4 bands + the legend
      expect(section.textContent).toMatch(
        /\d\d:\d\d.*\d\d:\d\d.*\d\d:\d\d.*\d\d:\d\d/,
      );
    });

    it('shows an empty state when the fetch fails', async () => {
      const error = expectConsole();
      const mock = createMockHa();
      mock.controls.failHistory(true);
      const store = createHaStore(mock.deps);
      await act(async () => {
        await store.start(mock.getAuth);
        render(
          <HaConnection store={store}>
            <HeatingSheet
              tile={tileOf('heating')}
              store={store}
              onClose={vi.fn()}
            />
          </HaConnection>,
          document.body,
        );
      });
      await act(async () => {});

      expect(document.body.textContent).toContain(
        'No demand history available',
      );
      expect(document.querySelector('.bg-accent')).not.toBeNull(); // legend only
      expect(
        document.querySelector(
          '[aria-label="Heating demand history"] [role="img"]',
        ),
      ).toBeNull();
      expect(error).toHaveLength(1);
    });
  });

  it('marks the schedule switch as the source of control', async () => {
    const { mock } = await setup();
    expect(mock.controls.getState(SCHEDULE)?.state).toBe('on');
  });

  it('closes with the Close button', async () => {
    const { press, onClose } = await setup();

    await press('Close');

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

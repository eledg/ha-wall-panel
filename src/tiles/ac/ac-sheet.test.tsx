// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AcSheet } from './ac-sheet.tsx';
import { config } from '../../config.ts';
import { HaConnection } from '../../ha/connection.tsx';
import { createHaStore } from '../../ha/store.ts';
import { createMockHa } from '../../mock/engine.ts';
import { acAttributes } from '../../mock/scenarios/ac.ts';
import { SETTLE_MS, TARGET_DEBOUNCE_MS } from '../use-climate-commands.ts';

const AC = config.entities.acClimate.id;
const POWERFUL = config.entities.acPowerful.id;
const OFFICE = config.entities.officeTemperature.id;

const setup = async ({
  on = true,
  onClose = vi.fn(),
  idleMs = 30_000,
} = {}) => {
  const mock = createMockHa();
  const store = createHaStore(mock.deps);
  const spy = vi.spyOn(store, 'callService');
  await act(async () => {
    await store.start(mock.getAuth);
    if (on) mock.controls.setState(AC, 'heat', acAttributes());
    render(
      <HaConnection store={store}>
        <AcSheet store={store} onClose={onClose} idleMs={idleMs} />
      </HaConnection>,
      document.body,
    );
  });
  const button = (name: string) =>
    [...document.querySelectorAll('button')].find(
      (b) =>
        b.textContent?.includes(name) || b.getAttribute('aria-label') === name,
    )!;
  const press = (name: string) => act(() => button(name).click());
  return { mock, store, spy, button, press, onClose };
};

afterEach(() => {
  vi.useRealTimers();
  render(null, document.body);
});

describe('AcSheet', () => {
  it('shows the current and target temperature and the settings', async () => {
    await setup();
    const text = document.body.textContent;

    expect(text).toContain('Office AC');
    expect(text).toContain('Heating · Fan Auto');
    expect(text).toContain('Heat');
    expect(text).toContain('Auto'); // fan speed
    expect(text).toContain('Swing'); // "Vertical Swing"
    expect(text).toContain('24.0°');
    for (const label of ['Powerful', 'Economy', 'Quiet']) {
      expect(text).toContain(label);
    }
  });

  it('shows the office sensor as the current temperature', async () => {
    const { mock } = await setup();
    await act(() => mock.controls.setState(OFFICE, '22.2', {}));

    expect(document.body.textContent).toContain('Office now');
    expect(document.body.textContent).toContain('22.2°');
    expect(document.body.textContent).not.toContain('24.0° ');
  });

  it('turns the AC off and closes the sheet once it succeeds', async () => {
    const { spy, press, onClose } = await setup();
    let resolve!: () => void;
    spy.mockReturnValueOnce(new Promise<void>((r) => (resolve = r)));

    await press('On');
    expect(spy).toHaveBeenLastCalledWith('acClimate', 'turn_off');
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => resolve());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('turns the AC on without closing the sheet', async () => {
    const { spy, press, onClose } = await setup({ on: false });

    await press('Off');
    expect(spy).toHaveBeenLastCalledWith('acClimate', 'turn_on');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('disables the other controls while off', async () => {
    const { button } = await setup({ on: false });

    for (const name of ['Mode', 'Fan speed', 'Swing', 'Powerful', 'Raise']) {
      expect((button(name) as HTMLButtonElement).disabled, name).toBe(true);
    }
    expect((button('Off') as HTMLButtonElement).disabled).toBe(false);
  });

  it('picks a mode from the entity modes, without Off', async () => {
    const { spy, press } = await setup();

    await press('Mode');
    const options = [...document.querySelectorAll('button[aria-pressed]')].map(
      (b) => b.lastChild?.textContent,
    );
    expect(options).toEqual(['Cool', 'Heat', 'Fan', 'Dry', 'Auto']);

    await press('Cool');
    expect(spy).toHaveBeenLastCalledWith('acClimate', 'set_hvac_mode', {
      hvac_mode: 'cool',
    });
    expect(document.body.textContent).toContain('Office AC');
  });

  it('picks a fan speed', async () => {
    const { spy, press } = await setup();

    await press('Fan speed');
    await press('Quiet');

    expect(spy).toHaveBeenLastCalledWith('acClimate', 'set_fan_mode', {
      fan_mode: 'Quiet',
    });
  });

  it('picks a swing position', async () => {
    const { spy, press } = await setup();

    await press('Swing');
    await press('Lowest');

    expect(spy).toHaveBeenLastCalledWith('acClimate', 'set_swing_mode', {
      swing_mode: 'Lowest',
    });
  });

  it('goes back from a picker without changing anything', async () => {
    const { spy, press } = await setup();

    await press('Fan speed');
    await press('Back');

    expect(spy).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Office AC');
  });

  it('toggles a switch', async () => {
    const { mock, spy, press, button } = await setup();

    await press('Powerful');

    expect(spy).toHaveBeenLastCalledWith('acPowerful', 'toggle');
    expect(mock.controls.getState(POWERFUL)?.state).toBe('on');
    expect(button('Powerful').getAttribute('aria-pressed')).toBe('true');
  });

  it('marks an unavailable switch n/a and disables it', async () => {
    const { mock, button } = await setup();

    await act(() => mock.controls.setUnavailable(POWERFUL));

    expect(button('Powerful').textContent).toContain('n/a');
    expect((button('Powerful') as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables a setting the entity has no options for', async () => {
    const { mock, button } = await setup();

    await act(() =>
      mock.controls.setState(AC, 'heat', {
        ...acAttributes(),
        fan_modes: [],
        fan_mode: undefined,
      }),
    );

    expect(button('Fan speed').textContent).toContain('Unavailable');
    expect((button('Fan speed') as HTMLButtonElement).disabled).toBe(true);
  });

  describe('target temperature', () => {
    it('steps at once and sends one call after the taps pause', async () => {
      vi.useFakeTimers();
      const { spy, press } = await setup();

      await press('Raise');
      await press('Raise');
      await press('Lower');
      expect(document.body.textContent).toContain('24.5°');
      expect(spy).not.toHaveBeenCalled();

      await act(() => {
        vi.advanceTimersByTime(TARGET_DEBOUNCE_MS);
      });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('acClimate', 'set_temperature', {
        temperature: 24.5,
      });
    });

    it('stops at the entity limits', async () => {
      const { mock, button } = await setup();

      await act(() =>
        mock.controls.setState(AC, 'heat', {
          ...acAttributes(),
          temperature: 30,
        }),
      );
      expect((button('Raise') as HTMLButtonElement).disabled).toBe(true);

      await act(() =>
        mock.controls.setState(AC, 'heat', {
          ...acAttributes(),
          temperature: 16,
        }),
      );
      expect((button('Lower') as HTMLButtonElement).disabled).toBe(true);
    });

    it('shows a dash when HA reports no temperature', async () => {
      const { mock } = await setup();
      const {
        current_temperature: _c,
        temperature: _t,
        ...rest
      } = acAttributes();

      await act(() => mock.controls.setState(AC, 'heat', rest));

      expect(document.body.textContent).toContain('—');
    });
  });

  describe('when a call fails', () => {
    const failing = async () => {
      const ctx = await setup();
      ctx.mock.controls.failServices(true);
      vi.spyOn(console, 'error').mockImplementation(() => {});
      return ctx;
    };

    it('reverts the mode and flashes it', async () => {
      vi.useFakeTimers();
      const { press, button } = await failing();

      await press('Mode');
      await press('Cool');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(button('Mode').textContent).toContain('Heat');
      expect(button('Mode').className).toContain('bg-warn-soft');
      await act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(button('Mode').className).not.toContain('bg-warn-soft');
    });

    it('reverts the power button', async () => {
      vi.useFakeTimers();
      const { press, button, onClose } = await failing();

      await press('On');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(onClose).not.toHaveBeenCalled();
      expect(button('On').textContent).toContain('On');
      expect(button('On').className).toContain('bg-warn-soft');
    });

    it('reverts a switch', async () => {
      vi.useFakeTimers();
      const { press, button } = await failing();

      await press('Powerful');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(button('Powerful').getAttribute('aria-pressed')).toBe('false');
      expect(button('Powerful').className).toContain('bg-warn-soft');
    });

    it('reverts the target', async () => {
      vi.useFakeTimers();
      const { press } = await failing();

      await press('Raise');
      expect(document.body.textContent).toContain('24.5°');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(TARGET_DEBOUNCE_MS);
      });

      expect(document.body.textContent).toContain('24.0°');
    });
  });

  describe('while HA has not confirmed', () => {
    const unconfirmed = async () => {
      vi.useFakeTimers();
      const ctx = await setup();
      // The call succeeds but HA reports nothing new.
      vi.spyOn(ctx.mock.deps, 'callService').mockResolvedValue(undefined);
      return ctx;
    };

    it('keeps the last value, marks the control busy and locks the rest', async () => {
      const { press, button } = await unconfirmed();

      await press('Powerful');

      expect(button('Powerful').getAttribute('aria-busy')).toBe('true');
      expect(button('Powerful').className).toContain('pending-pulse');
      expect(button('Powerful').getAttribute('aria-pressed')).toBe('false');
      for (const name of ['AC power', 'Mode', 'Economy', 'Raise']) {
        expect((button(name) as HTMLButtonElement).disabled, name).toBe(true);
      }
    });

    it('stops waiting after a while', async () => {
      const { press, button } = await unconfirmed();

      await press('Powerful');
      await act(() => {
        vi.advanceTimersByTime(SETTLE_MS);
      });

      expect(button('Powerful').getAttribute('aria-busy')).toBe('false');
      expect((button('Mode') as HTMLButtonElement).disabled).toBe(false);
    });

    it('shows placeholders while the AC powers on', async () => {
      vi.useFakeTimers();
      const { mock, press } = await setup({ on: false });
      vi.spyOn(mock.deps, 'callService').mockResolvedValue(undefined);

      await press('Off');

      expect(document.body.textContent).toContain('Turning on…');
      expect(
        document.querySelector('[aria-label="Loading AC settings"]'),
      ).not.toBeNull();
      expect(
        document.querySelector('[aria-label="AC target"]')?.textContent,
      ).not.toContain('°');
    });

    it('says the AC is switching off', async () => {
      const { press } = await unconfirmed();

      await press('On');

      expect(document.body.textContent).toContain('Turning off…');
    });
  });

  it('disables controls while HA is disconnected', async () => {
    const { mock, button } = await setup();

    await act(() => mock.controls.setConnected(false));

    for (const name of ['On', 'Mode', 'Powerful', 'Raise']) {
      expect((button(name) as HTMLButtonElement).disabled, name).toBe(true);
    }
  });

  describe('closing', () => {
    it('closes with the button and Escape', async () => {
      const { press, onClose } = await setup();

      await press('Close');
      expect(onClose).toHaveBeenCalledTimes(1);

      await act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });
      expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('closes after the idle time, restarted by touches', async () => {
      vi.useFakeTimers();
      const { onClose } = await setup({ idleMs: 1000 });

      await act(() => {
        vi.advanceTimersByTime(800);
      });
      await act(() => {
        document
          .querySelector('[role="dialog"]')!
          .dispatchEvent(new Event('pointerdown', { bubbles: true }));
      });
      await act(() => {
        vi.advanceTimersByTime(800);
      });
      expect(onClose).not.toHaveBeenCalled();

      await act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('holds back auto-reload while open', async () => {
      await setup();

      expect(document.querySelector('[data-blocks-reload]')).not.toBeNull();
    });
  });
});

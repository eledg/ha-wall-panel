// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FLASH_MS } from '@/config/constants.ts';

import {
  type ClimateCommands,
  type Command,
  SETTLE_MS,
  TARGET_DEBOUNCE_MS,
  useClimateCommands,
  useTargetSteps,
} from './use-climate-commands.ts';

type State = { on: boolean; target: number };

afterEach(() => {
  vi.useRealTimers();
  render(null, document.body);
});

/** Renders the hooks with a mutable state and exposes what they return. */
const setup = ({
  onClose = vi.fn(),
  idleMs = 30_000,
  initial = { on: true, target: 20 },
  call = vi.fn().mockResolvedValue(undefined),
} = {}) => {
  let state: State = initial;
  let commands!: ClimateCommands<State>;
  let steps!: ReturnType<typeof useTargetSteps<State>>;
  const Harness = ({ state }: { state: State }) => {
    commands = useClimateCommands(state, { name: 'Test', onClose, idleMs });
    steps = useTargetSteps({
      name: 'Test',
      state,
      targetOf: (s) => s.target,
      limits: { min: 5, max: 30, step: 0.5 },
      commands,
      call,
    });
    return <div>{steps.shown}</div>;
  };
  const draw = () =>
    act(() => render(<Harness state={state} />, document.body));
  const update = (next: State) => {
    state = next;
    return draw();
  };
  return {
    draw,
    update,
    call,
    onClose,
    cmd: () => commands,
    steps: () => steps,
  };
};

const power = (next: boolean): Command<State> => ({
  key: 'power',
  power: next,
  done: (s) => s.on === next,
});

describe('useClimateCommands', () => {
  it('waits on a command until the state confirms it', async () => {
    const { draw, update, cmd } = setup();
    await draw();

    await act(() => cmd().send(power(false), new Promise(() => {})));
    expect(cmd().pending?.key).toBe('power');

    await update({ on: false, target: 20 });
    expect(cmd().pending).toBeUndefined();
  });

  it('gives up waiting after SETTLE_MS', async () => {
    vi.useFakeTimers();
    const { draw, cmd } = setup();
    await draw();

    await act(() => cmd().send(power(false), new Promise(() => {})));
    await act(() => void vi.advanceTimersByTime(SETTLE_MS));

    expect(cmd().pending).toBeUndefined();
  });

  it('flashes the control whose call failed, then stops', async () => {
    vi.useFakeTimers();
    const { draw, cmd } = setup();
    await draw();

    await act(async () => {
      cmd().send(power(false), Promise.reject(new Error('no')));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(cmd().pending).toBeUndefined();
    expect(cmd().flash).toBe('power');

    await act(() => void vi.advanceTimersByTime(FLASH_MS));
    expect(cmd().flash).toBeUndefined();
  });

  it('holds a press-only command for its hold time, with no settle timeout', async () => {
    vi.useFakeTimers();
    const { draw, cmd } = setup();
    await draw();

    await act(async () => {
      cmd().send({ key: 'boost', hold: 800 }, Promise.resolve());
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(cmd().pending?.key).toBe('boost');

    await act(() => void vi.advanceTimersByTime(800));
    expect(cmd().pending).toBeUndefined();
  });

  it('runs onSuccess only when the call succeeds', async () => {
    const { draw, cmd } = setup();
    await draw();
    const onSuccess = vi.fn();

    await act(async () => {
      cmd().send(power(false), Promise.resolve(), onSuccess);
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);

    await act(async () => {
      cmd().send(power(true), Promise.reject(new Error('no')), onSuccess);
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape and after the idle time, restarted by activity', async () => {
    vi.useFakeTimers();
    const { draw, onClose, cmd } = setup({ idleMs: 1000 });
    await draw();

    await act(() => void vi.advanceTimersByTime(800));
    await act(() => cmd().onActivity());
    await act(() => void vi.advanceTimersByTime(800));
    expect(onClose).not.toHaveBeenCalled();
    await act(() => void vi.advanceTimersByTime(300));
    expect(onClose).toHaveBeenCalledTimes(1);

    await act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose.mock.calls.length).toBeGreaterThan(1);
  });
});

describe('useTargetSteps', () => {
  it('shows each step at once and sends one call after the taps pause', async () => {
    vi.useFakeTimers();
    const { draw, call, steps } = setup();
    await draw();

    await act(() => steps().step(1));
    await act(() => steps().step(1));
    await act(() => steps().step(-1));
    expect(steps().shown).toBe(20.5);
    expect(call).not.toHaveBeenCalled();

    await act(() => void vi.advanceTimersByTime(TARGET_DEBOUNCE_MS));
    expect(call).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledWith(20.5);
  });

  it('sends nothing when the taps return to the reported target', async () => {
    vi.useFakeTimers();
    const { draw, call, steps, cmd } = setup();
    await draw();

    await act(() => steps().step(1));
    await act(() => steps().step(-1));
    await act(() => void vi.advanceTimersByTime(TARGET_DEBOUNCE_MS));

    expect(call).not.toHaveBeenCalled();
    expect(cmd().pending).toBeUndefined();
  });

  it('keeps within the limits', async () => {
    const { draw, steps } = setup({ initial: { on: true, target: 30 } });
    await draw();

    await act(() => steps().step(1));
    expect(steps().shown).toBe(30);
  });

  it('puts the real target back and flashes when the call fails', async () => {
    vi.useFakeTimers();
    const { draw, steps, cmd } = setup({
      call: vi.fn().mockRejectedValue(new Error('no')),
    });
    await draw();

    await act(() => steps().step(1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TARGET_DEBOUNCE_MS);
    });

    expect(steps().shown).toBe(20);
    expect(cmd().flash).toBe('target');
    expect(cmd().pending).toBeUndefined();
  });

  it('does nothing without a reported target', async () => {
    const { draw, call, steps } = setup({
      initial: { on: true, target: undefined as unknown as number },
    });
    await draw();

    await act(() => steps().step(1));

    expect(call).not.toHaveBeenCalled();
  });
});

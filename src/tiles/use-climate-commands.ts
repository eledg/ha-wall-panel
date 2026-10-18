import { useEffect, useRef, useState } from 'preact/hooks';

import { FLASH_MS } from './climate-controls.tsx';
import { stepTarget, type TargetLimits } from './target.ts';

/** Rapid − / + taps are sent as one `set_temperature` once they pause. */
export const TARGET_DEBOUNCE_MS = 400;

/** Safety net: stop waiting if HA never reports the change. */
export const SETTLE_MS = 5000;

/**
 * A command HA has not confirmed yet. `done` says when the state shows it has
 * taken effect; a command without one (a button press) ends after `hold` ms.
 */
export type Command<S> = {
  key: string;
  done?: (state: S) => boolean;
  /** Power only: the state that was asked for. */
  power?: boolean;
  /** Press-only: how long to show as pending once the call succeeds. */
  hold?: number;
};

/**
 * The command bookkeeping shared by the climate sheets (AC, heating): one
 * command in flight at a time, the control that failed flashing, and closing on
 * Escape or after `idleMs` without a touch.
 *
 * A control never shows a guess: while a command waits for HA the sheet keeps
 * the last confirmed value, dimmed. A command ends when `done(state)` turns
 * true, when its `hold` runs out, or after `SETTLE_MS`.
 */
export const useClimateCommands = <S>(
  state: S,
  {
    name,
    onClose,
    idleMs,
  }: { name: string; onClose: () => void; idleMs: number },
) => {
  const [flash, setFlash] = useState<string>();
  const [issued, setIssued] = useState<Command<S>>();
  // A command is over as soon as HA reports its result.
  const confirmed = issued?.done?.(state) ?? false;
  const pending = confirmed ? undefined : issued;
  // Bumped by every touch inside the sheet to restart the idle timer.
  const [activity, setActivity] = useState(0);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const timer = setTimeout(onClose, idleMs);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, activity, idleMs]);
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(undefined), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flash]);
  useEffect(() => {
    if (confirmed) setIssued(undefined);
  }, [confirmed]);
  useEffect(() => {
    if (!pending || pending.hold !== undefined) return;
    const timer = setTimeout(() => setIssued(undefined), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [pending]);
  useEffect(() => () => clearTimeout(holdTimerRef.current), []);

  /** Starts waiting on a command. */
  const begin = (command: Command<S>) => {
    setFlash(undefined);
    setIssued(command);
  };
  /** Stops waiting on `command`, or on whatever is pending when none is given. */
  const end = (command?: Command<S>) =>
    setIssued((p) => (command === undefined || p === command ? undefined : p));
  /** Stops waiting on `command` and flashes its control. */
  const fail = (command: Command<S>) => {
    end(command);
    setFlash(command.key);
  };
  /** Begins a command and makes its call; a failure flashes the control. */
  const send = (
    command: Command<S>,
    call: Promise<unknown>,
    onSuccess?: () => void,
  ) => {
    begin(command);
    call.then(
      () => {
        onSuccess?.();
        if (command.hold !== undefined) {
          clearTimeout(holdTimerRef.current);
          holdTimerRef.current = setTimeout(() => end(command), command.hold);
        }
      },
      (err: unknown) => {
        console.error(`${name} ${command.key} failed`, err);
        fail(command);
      },
    );
  };

  return {
    pending,
    flash,
    begin,
    end,
    fail,
    send,
    onActivity: () => setActivity((n) => n + 1),
  };
};

export type ClimateCommands<S> = ReturnType<typeof useClimateCommands<S>>;

/**
 * Steps a target with − / +: each tap moves the shown target at once, and one
 * `call` is made once the taps pause. A failed call puts the real target back.
 */
export const useTargetSteps = <S>({
  name,
  state,
  targetOf,
  limits,
  commands,
  call,
}: {
  name: string;
  state: S;
  /** The target HA last reported. */
  targetOf: (state: S) => number | undefined;
  limits: TargetLimits;
  commands: ClimateCommands<S>;
  call: (target: number) => Promise<unknown>;
}) => {
  const [guess, setGuess] = useState<number>();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timerRef.current), []);
  const reported = targetOf(state);

  const step = (direction: 1 | -1) => {
    const from = guess ?? reported;
    if (from === undefined || reported === undefined) return;
    const next = stepTarget(from, direction, limits);
    clearTimeout(timerRef.current);
    if (next === reported) {
      // Back where HA already is: nothing to send.
      setGuess(undefined);
      commands.end();
      return;
    }
    setGuess(next);
    const command: Command<S> = {
      key: 'target',
      done: (s) => targetOf(s) === next,
    };
    commands.begin(command);
    timerRef.current = setTimeout(() => {
      call(next).catch((err: unknown) => {
        console.error(`${name} target failed`, err);
        setGuess(undefined);
        commands.fail(command);
      });
    }, TARGET_DEBOUNCE_MS);
  };

  return {
    step,
    /** The target to show: the guess while the change is in flight. */
    shown: commands.pending?.key === 'target' ? guess : reported,
  };
};

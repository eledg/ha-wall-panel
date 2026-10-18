import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

import {
  FLASH_MS,
  ModeIcon,
  pulseClass,
  SummaryButton,
  SwitchButton,
  SWITCHES,
  type SwitchKey,
  WARN,
} from './ac-controls.tsx';
import {
  acStatus,
  type AcView,
  modeLabel,
  optionLabel,
  readAc,
  stepTarget,
} from './ac-model.ts';
import { AcPicker } from './ac-picker.tsx';
import { AcTarget } from './ac-target.tsx';
import { IDLE_CLOSE_MS } from '../../diagnostics.tsx';
import { useOffline } from '../../ha/connection.tsx';
import { haStore } from '../../ha/instance.ts';
import type { HaStore } from '../../ha/store.ts';
import { useSnapshot } from '../../ha/use-snapshot.ts';
import { FanIcon } from '../../icons/fan-icon.tsx';
import { PowerIcon } from '../../icons/power-icon.tsx';
import { ClimateButton, ClimateSheet } from '../climate-controls.tsx';

/** Rapid − / + taps are sent as one `set_temperature` once they pause. */
export const TARGET_DEBOUNCE_MS = 400;

/** Safety net: stop waiting if HA never reports the change. */
export const SETTLE_MS = 5000;

type Picker = 'mode' | 'fan' | 'swing';
type SwitchStates = Record<SwitchKey, string | undefined>;

/** A command HA has not confirmed yet; `done` says when its state has arrived. */
type Pending = {
  key: string;
  done: (view: AcView, switches: SwitchStates) => boolean;
  /** Power only: the state that was asked for. */
  power?: boolean;
};

/**
 * Full-screen controls for the office AC, as in the design: power, the room
 * and target temperature, then mode, fan speed and swing (each opens a picker
 * of the entity's own options) and the Powerful / Economy / Quiet switches.
 *
 * A control never shows a guess. While a command waits for HA it keeps the
 * last confirmed value, dimmed, with a pulsing border, and every other control
 * is locked; turning the AC on shows placeholders until its settings arrive. If
 * the call fails the control flashes in the warning colours. Closes when the AC
 * is turned off, with the button, on Escape, or after `idleMs` without a touch.
 */
export const AcSheet = ({
  onClose,
  store = haStore,
  idleMs = IDLE_CLOSE_MS,
}: {
  onClose: () => void;
  store?: HaStore;
  idleMs?: number;
}) => {
  const entity = useSnapshot(store, (s) => s.entities.acClimate);
  const office = useSnapshot(store, (s) => s.entities.officeTemperature);
  const switchStates = useSnapshot(store, (s) =>
    SWITCHES.map(({ key }) => s.entities[key]?.state ?? '').join(','),
  );
  const offline = useOffline();
  const view = readAc(entity);
  const switches = Object.fromEntries(
    SWITCHES.map(({ key }, i) => [
      key,
      switchStates.split(',')[i] || undefined,
    ]),
  ) as SwitchStates;
  const officeTemp = Number.parseFloat(office?.state ?? '');
  const [picker, setPicker] = useState<Picker>();
  const [flash, setFlash] = useState<string>();
  const [issued, setPending] = useState<Pending>();
  // A command is over as soon as HA reports its result.
  const confirmed = issued?.done(view, switches) ?? false;
  const pending = confirmed ? undefined : issued;
  const [targetGuess, setTargetGuess] = useState<number>();
  // Bumped by every touch inside the sheet to restart the idle timer.
  const [activity, setActivity] = useState(0);
  const targetTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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
  // A command ends when HA reports its result, or when we give up waiting.
  useEffect(() => {
    if (confirmed) setPending(undefined);
  }, [confirmed]);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setPending(undefined), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [pending]);
  useEffect(() => () => clearTimeout(targetTimerRef.current), []);

  const send = (
    command: Pending,
    call: Promise<unknown>,
    onSuccess?: () => void,
  ) => {
    setFlash(undefined);
    setPending(command);
    call.then(onSuccess, (err: unknown) => {
      console.error(`AC ${command.key} failed`, err);
      setPending((p) => (p === command ? undefined : p));
      setFlash(command.key);
    });
  };

  const togglePower = () => {
    const next = !view.on;
    send(
      { key: 'power', power: next, done: (v) => v.on === next },
      store.callService('acClimate', next ? 'turn_on' : 'turn_off'),
      // Only close once HA accepts it, so a failure still shows on this screen.
      next ? undefined : onClose,
    );
  };
  const pick = (which: Picker, value: string) => {
    setPicker(undefined);
    const current = { mode: view.mode, fan: view.fan, swing: view.swing };
    if (value === current[which]) return;
    if (which === 'mode') {
      send(
        { key: 'mode', done: (v) => v.mode === value },
        store.callService('acClimate', 'set_hvac_mode', { hvac_mode: value }),
      );
    } else if (which === 'fan') {
      send(
        { key: 'fan', done: (v) => v.fan === value },
        store.callService('acClimate', 'set_fan_mode', { fan_mode: value }),
      );
    } else {
      send(
        { key: 'swing', done: (v) => v.swing === value },
        store.callService('acClimate', 'set_swing_mode', {
          swing_mode: value,
        }),
      );
    }
  };
  const toggleSwitch = (key: SwitchKey) => {
    const next = switches[key] !== 'on';
    send(
      { key, done: (_v, sw) => sw[key] === (next ? 'on' : 'off') },
      store.callService(key, 'toggle'),
    );
  };
  const step = (direction: 1 | -1) => {
    const from = targetGuess ?? view.target;
    if (from === undefined || view.target === undefined) return;
    const next = stepTarget(from, direction, view);
    clearTimeout(targetTimerRef.current);
    if (next === view.target) {
      // Back where HA already is: nothing to send.
      setTargetGuess(undefined);
      setPending(undefined);
      return;
    }
    setTargetGuess(next);
    setFlash(undefined);
    const command: Pending = { key: 'target', done: (v) => v.target === next };
    setPending(command);
    targetTimerRef.current = setTimeout(() => {
      store
        .callService('acClimate', 'set_temperature', { temperature: next })
        .catch((err: unknown) => {
          console.error('AC target failed', err);
          setPending((p) => (p === command ? undefined : p));
          setTargetGuess(undefined);
          setFlash('target');
        });
    }, TARGET_DEBOUNCE_MS);
  };

  const poweringOn = pending?.power === true && !view.on;
  const locked = offline || !view.usable || !view.on;
  // Anything but the target stepper is locked while a command is in flight.
  const busy = pending !== undefined;
  const target = pending?.key === 'target' ? targetGuess : view.target;
  const settings: {
    id: Picker;
    label: string;
    value: string | undefined;
    options: string[];
    text: (value: string) => string;
    icon: ComponentChildren;
  }[] = [
    {
      id: 'mode',
      label: 'Mode',
      value: view.mode,
      options: view.modes,
      text: modeLabel,
      icon: <ModeIcon mode={view.mode} />,
    },
    {
      id: 'fan',
      label: 'Fan speed',
      value: view.fan,
      options: view.fanModes,
      text: optionLabel,
      icon: <FanIcon />,
    },
    {
      id: 'swing',
      label: 'Swing',
      value: view.swing,
      options: view.swingModes,
      text: optionLabel,
      icon: <span class="text-base font-bold">⇅</span>,
    },
  ];
  const open = settings.find((s) => s.id === picker);

  if (open) {
    return (
      <ClimateSheet
        title={open.label}
        titleId="ac-picker-title"
        status="Office AC"
        onClose={onClose}
        onActivity={() => setActivity((n) => n + 1)}
      >
        <AcPicker
          options={open.options}
          value={open.value}
          text={open.text}
          withModeIcons={open.id === 'mode'}
          disabled={busy}
          onPick={(option) => pick(open.id, option)}
          onBack={() => setPicker(undefined)}
        />
      </ClimateSheet>
    );
  }

  return (
    <ClimateSheet
      title="Office AC"
      titleId="ac-title"
      status={acStatus(view, pending?.power)}
      warning={!view.usable}
      onClose={onClose}
      onActivity={() => setActivity((n) => n + 1)}
    >
      <div class="grid min-h-28 shrink-0 grid-cols-1 gap-4 min-[600px]:grid-cols-[112px_1fr]">
        <ClimateButton
          aria-label="AC power"
          aria-pressed={view.on}
          aria-busy={pending?.key === 'power'}
          disabled={offline || !view.usable || busy}
          class={`flex flex-col items-center justify-center gap-2 text-xl font-semibold ${pulseClass(pending?.key === 'power')} ${
            flash === 'power'
              ? WARN
              : view.on
                ? 'border-accent! bg-accent! text-accent-fg'
                : 'text-fg-dim'
          }`}
          onClick={togglePower}
        >
          <PowerIcon class="size-8" />
          {view.on ? 'On' : 'Off'}
        </ClimateButton>
        <AcTarget
          office={Number.isFinite(officeTemp) ? officeTemp : undefined}
          target={target}
          min={view.min}
          max={view.max}
          step={view.step}
          locked={locked && !poweringOn}
          busy={pending !== undefined && pending.key !== 'target'}
          pending={pending?.key === 'target'}
          skeleton={poweringOn}
          flashing={flash === 'target'}
          onStep={step}
        />
      </div>
      {poweringOn ? (
        <div
          class="grid grid-cols-1 gap-3 min-[600px]:grid-cols-3"
          aria-label="Loading AC settings"
          aria-busy="true"
        >
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              class="h-14 rounded-lg border border-line bg-surface-2"
            />
          ))}
        </div>
      ) : (
        <div class={`flex flex-col gap-3 ${view.on ? '' : 'opacity-50'}`}>
          <div class="grid grid-cols-1 gap-3 min-[600px]:grid-cols-3">
            {settings.map((s) => (
              <SummaryButton
                key={s.id}
                label={s.label}
                value={
                  s.options.length === 0 || s.value === undefined
                    ? 'Unavailable'
                    : s.text(s.value)
                }
                icon={s.icon}
                disabled={
                  locked ||
                  busy ||
                  s.options.length === 0 ||
                  s.value === undefined
                }
                pending={pending?.key === s.id}
                flashing={flash === s.id}
                onClick={() => setPicker(s.id)}
              />
            ))}
          </div>
          <div class="grid grid-cols-1 gap-3 min-[600px]:grid-cols-3">
            {SWITCHES.map(({ key, label }) => (
              <SwitchButton
                key={key}
                label={label}
                on={switches[key] === 'on'}
                usable={switches[key] === 'on' || switches[key] === 'off'}
                disabled={locked || busy}
                pending={pending?.key === key}
                flashing={flash === key}
                onToggle={() => toggleSwitch(key)}
              />
            ))}
          </div>
        </div>
      )}
    </ClimateSheet>
  );
};

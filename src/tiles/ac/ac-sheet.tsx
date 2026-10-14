import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

import {
  FLASH_MS,
  ModeIcon,
  SummaryButton,
  SwitchButton,
  SWITCHES,
  WARN,
} from './ac-controls.tsx';
import { IDLE_CLOSE_MS } from '../../diagnostics.tsx';
import { useOffline } from '../../ha/connection.tsx';
import { haStore } from '../../ha/instance.ts';
import type { HaStore } from '../../ha/store.ts';
import { useSnapshot } from '../../ha/use-snapshot.ts';
import { FanIcon } from '../../icons/fan-icon.tsx';
import { PowerIcon } from '../../icons/power-icon.tsx';
import { XIcon } from '../../icons/x-icon.tsx';
import { useOptimistic } from '../use-optimistic.ts';
import { modeLabel, optionLabel, readAc, stepTarget } from './ac-model.ts';
import { AcPicker } from './ac-picker.tsx';
import { AcTarget } from './ac-target.tsx';

/** Rapid − / + taps are sent as one `set_temperature` once they pause. */
export const TARGET_DEBOUNCE_MS = 400;

type Picker = 'mode' | 'fan' | 'swing';

/**
 * Full-screen controls for the office AC, as in the design: power, then mode,
 * fan speed and swing (each opens a picker of the entity's own options), the
 * Powerful / Economy / Quiet switches, and the target temperature.
 *
 * Every control updates at once (optimistic). If its service call fails it
 * reverts to HA's state and flashes in the warning colours. Closes when the AC
 * is turned off, with the button, on Escape, or after `idleMs` without a
 * touch, and holds back auto-reload while open.
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
  const offline = useOffline();
  const view = readAc(entity);
  const [picker, setPicker] = useState<Picker>();
  const [flash, setFlash] = useState<string>();
  // Bumped by every touch inside the sheet to restart the idle timer.
  const [activity, setActivity] = useState(0);
  const power = useOptimistic(view.on);
  const mode = useOptimistic(view.mode);
  const fan = useOptimistic(view.fan);
  const swing = useOptimistic(view.swing);
  const target = useOptimistic(view.target);
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

  const fail = (key: string) => setFlash(key);
  const send = (
    key: string,
    call: Promise<unknown>,
    rollback: () => void,
    onSuccess?: () => void,
  ) => {
    setFlash(undefined);
    call.then(onSuccess, (err: unknown) => {
      console.error(`AC ${key} failed`, err);
      rollback();
      fail(key);
    });
  };

  const togglePower = () => {
    const next = !power.value;
    power.guess(next);
    send(
      'power',
      store.callService('acClimate', next ? 'turn_on' : 'turn_off'),
      power.clear,
      // Only close once HA confirms, so a failure still shows on this screen.
      next ? undefined : onClose,
    );
  };
  const pick = (which: Picker, value: string) => {
    setPicker(undefined);
    if (which === 'mode') {
      mode.guess(value);
      send(
        'mode',
        store.callService('acClimate', 'set_hvac_mode', { hvac_mode: value }),
        mode.clear,
      );
    } else if (which === 'fan') {
      fan.guess(value);
      send(
        'fan',
        store.callService('acClimate', 'set_fan_mode', { fan_mode: value }),
        fan.clear,
      );
    } else {
      swing.guess(value);
      send(
        'swing',
        store.callService('acClimate', 'set_swing_mode', {
          swing_mode: value,
        }),
        swing.clear,
      );
    }
  };
  const step = (direction: 1 | -1) => {
    if (target.value === undefined) return;
    const next = stepTarget(target.value, direction, view);
    target.guess(next);
    clearTimeout(targetTimerRef.current);
    targetTimerRef.current = setTimeout(
      () =>
        send(
          'target',
          store.callService('acClimate', 'set_temperature', {
            temperature: next,
          }),
          target.clear,
        ),
      TARGET_DEBOUNCE_MS,
    );
  };

  const on = view.usable && power.value;
  const locked = offline || !on;
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
      value: mode.value,
      options: view.modes,
      text: modeLabel,
      icon: <ModeIcon mode={mode.value} />,
    },
    {
      id: 'fan',
      label: 'Fan speed',
      value: fan.value,
      options: view.fanModes,
      text: optionLabel,
      icon: <FanIcon />,
    },
    {
      id: 'swing',
      label: 'Swing',
      value: swing.value,
      options: view.swingModes,
      text: optionLabel,
      icon: <span class="text-base font-bold">⇅</span>,
    },
  ];
  const open = settings.find((s) => s.id === picker);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Office air conditioning"
      data-blocks-reload
      class="fixed inset-0 z-20 bg-bg/90 p-6"
      onPointerDown={() => setActivity((n) => n + 1)}
    >
      <div class="flex h-full flex-col rounded-tile border border-line bg-surface p-5">
        <div class="mb-4 flex items-center justify-between gap-4">
          <h2 class="min-w-0 text-2xl leading-snug font-semibold">
            {open ? open.label : 'Office air conditioning'}
          </h2>
          <button
            type="button"
            aria-label="Close"
            class="tap grid size-14 shrink-0 place-items-center rounded-full bg-surface-2"
            onClick={onClose}
          >
            <XIcon class="size-7" />
          </button>
        </div>
        {open ? (
          <AcPicker
            options={open.options}
            value={open.value}
            text={open.text}
            withModeIcons={open.id === 'mode'}
            onPick={(option) => pick(open.id, option)}
            onBack={() => setPicker(undefined)}
          />
        ) : (
          <div class="grid min-h-0 flex-1 grid-cols-[auto_1fr] gap-4">
            <button
              type="button"
              disabled={offline || !view.usable}
              aria-pressed={on}
              class={`tap flex w-32 flex-col items-center justify-center gap-2 rounded-2xl border text-xl font-semibold ${
                flash === 'power'
                  ? WARN
                  : on
                    ? 'border-accent bg-accent text-accent-fg'
                    : 'border-line bg-surface-2'
              }`}
              onClick={togglePower}
            >
              <PowerIcon class="size-10" />
              {on ? 'On' : 'Off'}
            </button>
            <div
              class={`flex min-h-0 flex-col gap-3 ${on ? '' : 'opacity-50'}`}
            >
              <div class="grid grid-cols-3 gap-2">
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
                      locked || s.options.length === 0 || s.value === undefined
                    }
                    flashing={flash === s.id}
                    onClick={() => setPicker(s.id)}
                  />
                ))}
              </div>
              <div class="grid grid-cols-3 gap-2">
                {SWITCHES.map(({ key, label }) => (
                  <SwitchButton
                    key={key}
                    store={store}
                    entity={key}
                    label={label}
                    disabled={locked}
                    flashing={flash === key}
                    onFail={fail}
                  />
                ))}
              </div>
              <AcTarget
                current={view.current}
                target={target.value}
                min={view.min}
                max={view.max}
                step={view.step}
                locked={locked}
                flashing={flash === 'target'}
                onStep={step}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';

import {
  ModeIcon,
  SummaryButton,
  SwitchButton,
  SWITCHES,
  type SwitchKey,
} from './ac-controls.tsx';
import { acStatus, modeLabel, optionLabel, readAc } from './ac-model.ts';
import { AcPicker } from './ac-picker.tsx';
import { IDLE_CLOSE_MS } from '../../diagnostics.tsx';
import { useOffline } from '../../ha/connection.tsx';
import { haStore } from '../../ha/instance.ts';
import type { HaStore } from '../../ha/store.ts';
import { useSnapshot } from '../../ha/use-snapshot.ts';
import { FanIcon } from '../../icons/fan-icon.tsx';
import { ClimateSheet, PowerButton } from '../climate-controls.tsx';
import { TargetStepper } from '../target-stepper.tsx';
import { useClimateCommands, useTargetSteps } from '../use-climate-commands.ts';

type Picker = 'mode' | 'fan' | 'swing';
type SwitchStates = Record<SwitchKey, string | undefined>;

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
  const state = { view, switches };
  const [picker, setPicker] = useState<Picker>();
  const commands = useClimateCommands(state, { name: 'AC', onClose, idleMs });
  const { pending, flash, send, onActivity } = commands;
  const steps = useTargetSteps({
    name: 'AC',
    state,
    targetOf: (s) => s.view.target,
    limits: view,
    commands,
    call: (temperature) =>
      store.callService('acClimate', 'set_temperature', { temperature }),
  });

  const togglePower = () => {
    const next = !view.on;
    send(
      { key: 'power', power: next, done: (s) => s.view.on === next },
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
        { key: 'mode', done: (s) => s.view.mode === value },
        store.callService('acClimate', 'set_hvac_mode', { hvac_mode: value }),
      );
    } else if (which === 'fan') {
      send(
        { key: 'fan', done: (s) => s.view.fan === value },
        store.callService('acClimate', 'set_fan_mode', { fan_mode: value }),
      );
    } else {
      send(
        { key: 'swing', done: (s) => s.view.swing === value },
        store.callService('acClimate', 'set_swing_mode', {
          swing_mode: value,
        }),
      );
    }
  };
  const toggleSwitch = (key: SwitchKey) => {
    const next = switches[key] !== 'on';
    send(
      { key, done: (s) => s.switches[key] === (next ? 'on' : 'off') },
      store.callService(key, 'toggle'),
    );
  };
  const poweringOn = pending?.power === true && !view.on;
  const locked = offline || !view.usable || !view.on;
  // Anything but the target stepper is locked while a command is in flight.
  const busy = pending !== undefined;
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
        onActivity={onActivity}
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
      onActivity={onActivity}
    >
      <div class="grid min-h-28 shrink-0 grid-cols-1 gap-4 min-[600px]:grid-cols-[112px_1fr]">
        <PowerButton
          label="AC power"
          on={view.on}
          disabled={offline || !view.usable || busy}
          pending={pending?.key === 'power'}
          flashing={flash === 'power'}
          onClick={togglePower}
        />
        <TargetStepper
          currentLabel="Office now"
          targetLabel="AC target"
          current={Number.isFinite(officeTemp) ? officeTemp : undefined}
          target={steps.shown}
          min={view.min}
          max={view.max}
          step={view.step}
          locked={locked && !poweringOn}
          busy={pending !== undefined && pending.key !== 'target'}
          pending={pending?.key === 'target'}
          skeleton={poweringOn}
          flashing={flash === 'target'}
          onStep={steps.step}
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

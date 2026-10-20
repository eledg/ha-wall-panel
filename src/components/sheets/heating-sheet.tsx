import { useEffect, useState } from 'preact/hooks';

import {
  ClimateButton,
  ClimateSheet,
  PowerButton,
  pulseClass,
  WARN,
} from '@/components/climate/climate-controls.tsx';
import {
  HeatingHistory,
  HISTORY_HOURS,
} from '@/components/climate/heating-history.tsx';
import { TargetStepper } from '@/components/climate/target-stepper.tsx';
import { HeatWavesIcon } from '@/components/icons/heat-waves-icon.tsx';
import type { TileConfig } from '@/config/config.ts';
import { IDLE_CLOSE_MS } from '@/config/constants.ts';
import {
  useClimateCommands,
  useTargetSteps,
} from '@/hooks/use-climate-commands.ts';
import { useOffline } from '@/hooks/use-offline.ts';
import { useSnapshot } from '@/hooks/use-snapshot.ts';
import {
  canBoost,
  canResume,
  heatingStatus,
  readHeating,
} from '@/lib/climate/heating-model.ts';
import { type Interval, toIntervals } from '@/services/ha/history.ts';
import { haStore } from '@/services/ha/instance.ts';
import type { HaStore } from '@/services/ha/store.ts';

/** How long Resume and Boost show as pending: their buttons never report a state. */
export const PRESS_MS = 800;

/** The demand history is re-read this often while the sheet is open. */
export const HISTORY_REFRESH_MS = 60_000;

type Window = { start: number; end: number; intervals: Interval[] | undefined };

/**
 * Full-screen heating controls, as in the design: power, the living room and
 * target temperature, Resume schedule, Boost and the last six hours of boiler
 * demand. Built like the AC sheet: a command keeps the last confirmed value,
 * dimmed with a pulsing border, until HA reports it; a failed call flashes the
 * control in the warning colours. Resume and Boost are press-only (HA never
 * reports their state), so their pending state is a short local timer.
 */
export const HeatingSheet = ({
  tile,
  onClose,
  store = haStore,
  idleMs = IDLE_CLOSE_MS,
}: {
  tile: TileConfig<'heating'>;
  onClose: () => void;
  store?: HaStore;
  idleMs?: number;
}) => {
  const { entities } = tile;
  const climate = useSnapshot(store, (s) => s.entities[entities.climate]);
  const schedule = useSnapshot(store, (s) => s.entities[entities.schedule]);
  const demand = useSnapshot(store, (s) => s.entities[entities.demand]);
  const cloud = useSnapshot(store, (s) => s.entities[entities.cloud]);
  const offline = useOffline();
  const view = readHeating(climate, schedule, demand, cloud);
  const commands = useClimateCommands(view, {
    name: 'Heating',
    onClose,
    idleMs,
  });
  const { pending, flash, send, onActivity } = commands;
  const steps = useTargetSteps({
    name: 'Heating',
    state: view,
    targetOf: (v) => v.target,
    limits: view,
    commands,
    call: (temperature) =>
      store.callService('climate', entities.climate, 'set_temperature', {
        temperature,
      }),
  });
  const [history, setHistory] = useState<Window>();

  // Demand history: read on open, then refreshed while the sheet stays open.
  // A failed refresh keeps what is on screen; a failed first read shows the
  // empty state.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      const end = Date.now();
      const start = end - HISTORY_HOURS * 3_600_000;
      store
        .history(entities.demand, new Date(start), new Date(end))
        .then(
          (rows) => toIntervals(rows, start, end),
          (err: unknown) => {
            console.error('Heating demand history failed', err);
            return undefined;
          },
        )
        .then((intervals) => {
          if (cancelled) return;
          setHistory((previous) =>
            intervals === undefined && previous?.intervals
              ? previous
              : { start, end, intervals: intervals ?? [] },
          );
        });
    };
    load();
    const timer = setInterval(load, HISTORY_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [store, entities.demand]);

  const togglePower = () => {
    const next = !view.on;
    send(
      { key: 'power', power: next, done: (v) => v.on === next },
      store.callService('climate', entities.climate, 'set_hvac_mode', {
        hvac_mode: next ? 'heat' : 'off',
      }),
    );
  };
  const press = (key: 'resume' | 'boost') =>
    send(
      { key, hold: PRESS_MS },
      store.callService('button', entities[key], 'press'),
    );
  const busy = pending !== undefined;
  const locked = offline || !view.usable || !view.on;
  const stale = offline;
  const actionsOff = offline || busy;

  return (
    <ClimateSheet
      title="Central heating"
      titleId="heating-title"
      status={heatingStatus(view, stale, pending?.power)}
      warning={!view.usable}
      onClose={onClose}
      onActivity={onActivity}
    >
      <div class="grid min-h-28 shrink-0 grid-cols-1 gap-4 min-[600px]:grid-cols-[112px_1fr]">
        <PowerButton
          label="Heating power"
          on={view.on}
          disabled={offline || !view.usable || busy}
          pending={pending?.key === 'power'}
          flashing={flash === 'power'}
          onClick={togglePower}
        />
        <TargetStepper
          currentLabel={`${tile.roomLabel} now`}
          targetLabel="Heating target"
          current={view.current}
          target={steps.shown}
          min={view.min}
          max={view.max}
          step={view.step}
          locked={locked}
          busy={pending !== undefined && pending.key !== 'target'}
          pending={pending?.key === 'target'}
          skeleton={false}
          flashing={flash === 'target'}
          onStep={steps.step}
        />
      </div>
      <div class="grid shrink-0 grid-cols-2 gap-3">
        <ClimateButton
          disabled={actionsOff || !canResume(view)}
          aria-busy={pending?.key === 'resume'}
          class={`flex items-center justify-center gap-2 font-medium ${
            flash === 'resume' ? WARN : ''
          } ${pulseClass(pending?.key === 'resume')}`}
          onClick={() => press('resume')}
        >
          <span aria-hidden="true">↶</span>
          <span>Resume schedule</span>
        </ClimateButton>
        <ClimateButton
          disabled={actionsOff || !canBoost(view)}
          aria-busy={pending?.key === 'boost'}
          class={`flex items-center justify-center gap-2 font-medium ${
            flash === 'boost' ? WARN : ''
          } ${pulseClass(pending?.key === 'boost')}`}
          onClick={() => press('boost')}
        >
          <HeatWavesIcon demand class="size-5" />
          <span>Boost</span>
        </ClimateButton>
      </div>
      <HeatingHistory
        intervals={history?.intervals}
        start={history?.start}
        end={history?.end}
      />
    </ClimateSheet>
  );
};

import { ClimateButton, pulseClass, WARN } from './climate-controls.tsx';
import { Temperature } from './device-tile.tsx';
import { formatTarget } from './target.ts';
import { MinusIcon } from '../icons/minus-icon.tsx';
import { PlusIcon } from '../icons/plus-icon.tsx';

/** A room temperature, and the target with − / + buttons. */
export const TargetStepper = ({
  currentLabel,
  targetLabel,
  current,
  target,
  min,
  max,
  step,
  locked,
  busy,
  pending,
  skeleton,
  flashing,
  onStep,
}: {
  /** Caption above the room temperature, e.g. `Office now`. */
  currentLabel: string;
  /** Accessible name of the target readout, e.g. `AC target`. */
  targetLabel: string;
  /** The room temperature to show next to the target. */
  current: number | undefined;
  target: number | undefined;
  min: number;
  max: number;
  step: number;
  /** Off or disconnected. */
  locked: boolean;
  /** Another command is waiting for HA. */
  busy: boolean;
  /** The target itself is waiting for HA. */
  pending: boolean;
  /** Powering on: the real target isn't known yet. */
  skeleton: boolean;
  flashing: boolean;
  onStep: (direction: 1 | -1) => void;
}) => {
  const disabled = locked || busy;
  return (
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="text-fg-dim">
        <div class="mb-1 text-sm">{currentLabel}</div>
        {current === undefined ? (
          <span class="tnum text-4xl font-semibold">—</span>
        ) : (
          <Temperature value={formatTarget(current, step)} muted />
        )}
      </div>
      <div
        class={`flex items-center gap-3 ${locked && !skeleton ? 'opacity-50' : ''}`}
      >
        <ClimateButton
          aria-label="Lower"
          disabled={disabled || target === undefined || target <= min}
          class="grid size-14 shrink-0 place-items-center rounded-full"
          onClick={() => onStep(-1)}
        >
          <MinusIcon class="size-7" />
        </ClimateButton>
        <div
          aria-label={targetLabel}
          aria-busy={pending || skeleton}
          class={`w-28 rounded-lg border py-2 text-center ${
            flashing ? WARN : 'border-line'
          } ${pulseClass(pending)}`}
        >
          <div class="mb-1 text-sm text-fg-dim">Target</div>
          {skeleton ? (
            <span
              aria-hidden="true"
              class="mx-auto block h-10 w-20 rounded bg-surface-2"
            />
          ) : target === undefined ? (
            <span class="tnum text-4xl font-semibold">—</span>
          ) : (
            <Temperature value={formatTarget(target, step)} />
          )}
        </div>
        <ClimateButton
          aria-label="Raise"
          disabled={disabled || target === undefined || target >= max}
          class="grid size-14 shrink-0 place-items-center rounded-full"
          onClick={() => onStep(1)}
        >
          <PlusIcon class="size-7" />
        </ClimateButton>
      </div>
    </div>
  );
};

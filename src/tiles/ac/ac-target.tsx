import { pulseClass, WARN } from './ac-controls.tsx';
import { formatTemp } from './ac-model.ts';
import { MinusIcon } from '../../icons/minus-icon.tsx';
import { PlusIcon } from '../../icons/plus-icon.tsx';
import { ClimateButton } from '../climate-controls.tsx';
import { Temperature } from '../device-tile.tsx';

/** The office room temperature, and the target with − / + buttons. */
export const AcTarget = ({
  office,
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
  /** The office sensor, not the AC's own intake reading. */
  office: number | undefined;
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
        <div class="mb-1 text-sm">Office now</div>
        {office === undefined ? (
          <span class="tnum text-4xl font-semibold">—</span>
        ) : (
          <Temperature value={formatTemp(office, step)} muted />
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
          aria-label="AC target"
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
            <Temperature value={formatTemp(target, step)} />
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

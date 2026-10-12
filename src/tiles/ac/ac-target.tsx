import { formatTemp } from './ac-model.ts';
import { MinusIcon } from '../../icons/minus-icon.tsx';
import { PlusIcon } from '../../icons/plus-icon.tsx';

/** The room temperature, and the target with − / + buttons. */
export const AcTarget = ({
  current,
  target,
  min,
  max,
  step,
  locked,
  flashing,
  onStep,
}: {
  current: number | undefined;
  target: number | undefined;
  min: number;
  max: number;
  step: number;
  locked: boolean;
  flashing: boolean;
  onStep: (direction: 1 | -1) => void;
}) => (
  <div
    class={`flex flex-1 items-center justify-between gap-4 rounded-xl px-4 ${
      flashing ? 'bg-warn-soft' : 'bg-surface-2'
    }`}
  >
    <div>
      <div class="text-sm text-fg-dim">Now</div>
      <div class="tnum text-3xl font-semibold text-fg-dim">
        {current === undefined ? '—' : formatTemp(current, step)}
      </div>
    </div>
    <div class="flex items-center gap-3">
      <button
        type="button"
        aria-label="Lower"
        disabled={locked || target === undefined || target <= min}
        class="tap grid size-14 place-items-center rounded-full border border-line bg-surface disabled:opacity-30"
        onClick={() => onStep(-1)}
      >
        <MinusIcon class="size-7" />
      </button>
      <div class="w-28 text-center">
        <div class="text-sm text-fg-dim">Target</div>
        <div class="tnum text-4xl font-semibold">
          {target === undefined ? '—' : formatTemp(target, step)}
        </div>
      </div>
      <button
        type="button"
        aria-label="Raise"
        disabled={locked || target === undefined || target >= max}
        class="tap grid size-14 place-items-center rounded-full border border-line bg-surface disabled:opacity-30"
        onClick={() => onStep(1)}
      >
        <PlusIcon class="size-7" />
      </button>
    </div>
  </div>
);

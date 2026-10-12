import { ACTIVE, ModeIcon, NORMAL } from './ac-controls.tsx';

/** Full-sheet grid of one setting's options, with a Back button. */
export const AcPicker = ({
  options,
  value,
  text,
  withModeIcons = false,
  onPick,
  onBack,
}: {
  options: string[];
  value: string | undefined;
  text: (option: string) => string;
  withModeIcons?: boolean;
  onPick: (option: string) => void;
  onBack: () => void;
}) => (
  <>
    <div
      class="grid min-h-0 flex-1 gap-3"
      style={{
        gridTemplateColumns: `repeat(${Math.max(options.length, 1)}, minmax(0, 1fr))`,
      }}
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === value}
          class={`tap flex flex-col items-center justify-center gap-2 rounded-2xl border text-lg font-medium ${
            option === value ? ACTIVE : NORMAL
          }`}
          onClick={() => onPick(option)}
        >
          {withModeIcons && <ModeIcon mode={option} />}
          {text(option)}
        </button>
      ))}
    </div>
    <button
      type="button"
      class="tap mt-3 h-14 rounded-xl border border-line bg-surface-2 text-fg-dim"
      onClick={onBack}
    >
      Back
    </button>
  </>
);

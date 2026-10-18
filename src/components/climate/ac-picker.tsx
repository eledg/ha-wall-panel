import { ACTIVE, ModeIcon, NORMAL } from './ac-controls.tsx';
import { ClimateButton } from './climate-controls.tsx';

/** Full-sheet grid of one setting's options, with a Back button. */
export const AcPicker = ({
  options,
  value,
  text,
  withModeIcons = false,
  disabled = false,
  onPick,
  onBack,
}: {
  options: string[];
  value: string | undefined;
  text: (option: string) => string;
  withModeIcons?: boolean;
  disabled?: boolean;
  onPick: (option: string) => void;
  onBack: () => void;
}) => (
  <>
    <div
      class="grid min-h-36 flex-1 grid-cols-2 gap-3 landscape:grid-cols-(--option-grid)"
      style={{
        '--option-grid': `repeat(${Math.max(options.length, 1)}, minmax(0, 1fr))`,
      }}
    >
      {options.map((option) => (
        <ClimateButton
          key={option}
          disabled={disabled}
          aria-pressed={option === value}
          class={`flex flex-col items-center justify-center gap-2 text-lg font-medium ${
            option === value ? ACTIVE : NORMAL
          }`}
          onClick={() => onPick(option)}
        >
          {withModeIcons && <ModeIcon mode={option} />}
          {text(option)}
        </ClimateButton>
      ))}
    </div>
    <ClimateButton class="shrink-0 text-fg-dim" onClick={onBack}>
      Back
    </ClimateButton>
  </>
);

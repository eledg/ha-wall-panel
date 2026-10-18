/** The limits and step of a target temperature. */
export type TargetLimits = { min: number; max: number; step: number };

/** The target one step up (`1`) or down (`-1`), kept within the limits. */
export const stepTarget = (
  target: number,
  direction: 1 | -1,
  { min, max, step }: TargetLimits,
) =>
  Math.min(
    max,
    Math.max(min, Math.round((target + direction * step) * 100) / 100),
  );

/** `24.5`, with as many decimals as the step has (`24.0` for a 0.5 step). */
export const formatTarget = (value: number, step: number) =>
  value.toFixed(String(step).split('.')[1]?.length ?? 0);

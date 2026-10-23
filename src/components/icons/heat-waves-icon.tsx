import type { DemandLevel } from '@/lib/climate/heating-model.ts';

const label = (level: DemandLevel) => {
  if (level === 0) return 'No heating demand';
  return level === 3 ? 'Calling for heat' : `Calling for heat: ${level} of 3`;
};

/**
 * Three curved heat waves, filled left to right by how hard the boiler is
 * called for heat and outlined beyond that. Labelled, as it is the only cue
 * on the tile.
 */
export const HeatWavesIcon = ({
  level,
  class: className = 'size-5',
}: {
  level: DemandLevel;
  class?: string;
}) => (
  <svg
    viewBox="0 0 24 24"
    class={`shrink-0 ${className}`}
    role="img"
    aria-label={label(level)}
  >
    {[0, 7, 14].map((offset, i) => (
      <path
        key={offset}
        transform={`translate(${offset} 0)`}
        d="M5 2C1 6 8 8 4 12C0 16 7 18 4 22L6 22C10 18 3 16 7 12C11 8 4 6 7 2Z"
        fill={i < level ? 'currentColor' : 'none'}
        stroke="currentColor"
        stroke-width="0.8"
      />
    ))}
  </svg>
);

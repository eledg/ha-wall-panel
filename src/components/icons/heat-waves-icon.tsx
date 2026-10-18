/**
 * Three curved heat waves: filled while the boiler is called for heat,
 * outlined while it isn't. Labelled, as it is the only cue on the tile.
 */
export const HeatWavesIcon = ({
  demand,
  class: className = 'size-5',
}: {
  demand: boolean;
  class?: string;
}) => (
  <svg
    viewBox="0 0 24 24"
    class={`shrink-0 ${className}`}
    role="img"
    aria-label={demand ? 'Calling for heat' : 'No heating demand'}
  >
    {[0, 7, 14].map((offset) => (
      <path
        key={offset}
        transform={`translate(${offset} 0)`}
        d="M5 2C1 6 8 8 4 12C0 16 7 18 4 22L6 22C10 18 3 16 7 12C11 8 4 6 7 2Z"
        fill={demand ? 'currentColor' : 'none'}
        stroke="currentColor"
        stroke-width="0.8"
      />
    ))}
  </svg>
);

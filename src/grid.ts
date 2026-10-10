/**
 * Tile grid for the wall display (landscape 6 x 3). Each tile names its area;
 * areas without a tile yet stay empty. Edit here when a tile is added.
 * Mirrors GRID_CONFIG in the Lovable prototype (docs/design.md).
 */
export const GRID = {
  cols: 'repeat(6, minmax(0, 1fr))',
  rows: 'repeat(3, minmax(0, 1fr))',
  areas:
    '"clock clock clock cal cal cal" "weather weather weather cal cal cal" "light light temp ac door door"',
  areasNarrow:
    '"clock clock" "weather weather" "cal cal" "light temp" "ac door"',
} as const;

export type GridArea =
  'clock' | 'weather' | 'cal' | 'light' | 'temp' | 'ac' | 'door';

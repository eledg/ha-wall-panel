# Design

The look and layout of the panel come from a design made in
[Lovable](https://lovable.dev). The design was only a visual reference: every
component here is hand-written Preact, and the design's own code is not part of
this repo. This page records the rules the UI follows, so a change can keep to
them.

## Porting rules

- Hand-written Preact components, no new dependencies. No component library,
  router or CSS-in-JS.
- Every `<button>` needs an opaque background (`bg-surface` etc.), or the
  display paints it grey. See [Rendering quirks](display.md#rendering-quirks).
- No sliders (dragging can pull up the system panel). Use plus/minus buttons.
- Keep taps out of the `p-edge` zone.
- Overlays set `data-blocks-reload` so auto-reload waits for them.
- Keep the self-hosted Open Sans font; the display may be offline.
- The AC sheet shows Mode, Fan speed and Swing as three summary buttons; each opens
  a full-sheet picker of the entity's own options.
- Real data comes from the HA store (`src/services/ha/`), never from fixtures in
  a component. Fixtures live in the mock (`src/dev/mock/`, see [mock.md](mock.md)).

## What is shared

- **Tokens** are in `src/index.css`, one `@theme` block with the names `bg`,
  `surface`, `surface-2`, `line`, `fg`, `fg-dim`, `fg-faint`, `accent`,
  `accent-fg`, `accent-soft`, `warn`, `warn-soft` and `cal-*`. Colours are oklch,
  which needs Chromium 111 or newer. A second block swaps in a dimmer, warmer
  palette at night.
- **Grid** is in `src/lib/grid.ts`: 6 columns by 3 rows. A tile places itself from
  its config (`col`, `row`, `w`, `h`, see `placeStyle` and the `tile-place` class
  in `src/index.css`); cells without a tile stay empty. Portrait falls back to
  two columns, filled in the order the tiles are listed.
- **Tile shell** is `src/components/tiles/base/tile.tsx`. Tile states are `loading`, `normal`,
  `unavailable` and `stale`.

Pixel shift (a slow few-pixel drift of the tile grid, `src/hooks/use-pixel-shift.ts`)
was added for burn-in (see [display.md](display.md)).

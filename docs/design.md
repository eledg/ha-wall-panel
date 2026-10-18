# Design reference

The look and layout of the dashboard come from a prototype made in Lovable. It
lives in `.lovable-design/`, which is **git-ignored**: it exists only on the
author's machine, so it may be missing in a fresh clone. Treat it as a visual
reference, not as code to import or as the source of truth for behaviour.

The prototype uses a different stack (React 19, TanStack Start, shadcn/Radix,
bun), so nothing maps one to one. Port the design by hand, one tile at a time.

## Where to look in the prototype

| File                                  | What it holds                                                                          |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/components/wall/WallDisplay.tsx` | Every tile, the shared `Tile` shell, the AC sheet, the doorbell overlay, `GRID_CONFIG` |
| `src/components/wall/icons.tsx`       | Inline SVG icons                                                                       |
| `src/styles.css`                      | Design tokens (one `@theme` block), `tap`, `tnum`, `dash-grid`                         |
| `src/components/wall/Heating.tsx`     | The Heating tile, sheet and `DeviceTile`; `src/lib/heating.ts` holds its rules         |
| `src/lib/mock.ts`                     | Home Assistant shaped fixtures (weather, calendar, climate, camera, heating)           |
| `src/routes/index.tsx`                | Device frame and the dev controls (night mode, stale, offline, ...)                    |

Most of `src/components/ui/` is unused shadcn scaffolding; ignore it.

## Porting rules

- Hand-written Preact components, no new dependencies. No shadcn, Radix or router.
- Every `<button>` needs an opaque background (`bg-surface` etc.), or the
  display paints it grey. See [Rendering quirks](display.md#rendering-quirks).
- No sliders (dragging can pull up the system panel). Use plus/minus buttons.
- Keep taps out of the `p-edge` zone.
- Overlays set `data-blocks-reload` so auto-reload waits for them.
- Keep the self-hosted Open Sans font; the display may be offline.
- The AC sheet shows Mode, Fan speed and Swing as three summary buttons; each opens
  a full-sheet picker of the entity's own options (the prototype's `AcPanel`).
- Real data comes from the HA store (`src/ha/`), not from the prototype's mock.

## What is shared

- **Tokens** are in `src/index.css`, copied from the prototype's `styles.css`
  with the same names (`bg`, `surface`, `surface-2`, `line`, `fg`, `fg-dim`,
  `fg-faint`, `accent`, `accent-fg`, `accent-soft`, `warn`, `warn-soft`,
  `cal-*`). Colours are oklch, which needs Chromium 111 or newer.
- **Grid** is in `src/grid.ts`: 6 columns by 3 rows of named areas. A tile
  places itself with its `area`; areas without a tile stay empty. Portrait falls
  back to two columns.
- **Tile shell** is `src/tiles/tile.tsx`. Tile states are `loading`, `normal`,
  `unavailable` and `stale`.

Pixel shift (a slow few-pixel drift of the tile grid, `src/pixel-shift.ts`) is not in the prototype; it was added for burn-in (#31, `docs/display.md`).

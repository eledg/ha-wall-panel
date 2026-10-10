# Mock HA

`pnpm dev:mock` runs the app against a fake Home Assistant (`src/ha/mock.ts`), so
tiles can be checked by eye with no token and no real HA. It is never part of a
build (a build test checks).

The light buttons live in the Diagnostics modal (tap the version, bottom right).
The weather controls are in the **Mock** dock, which opens beside the tiles so the
effect of each button stays visible.

The dock (button bottom left) has:

- **Weather**: a scenario per condition, plus `All icons` (every icon in one
  forecast), `Extremes` (`-12°`, `38°`, `100°`: layout width), `Odd data` (no
  temperature, an unmapped condition, holes in the forecast), `No forecast`
  (entity without hourly support) and `Short forecast` (fewer than five columns).
- **Entity**: Unavailable, Missing (wrong or deleted ID) and Restore.
- **Connection**: Disconnected shows the tile dimmed with a `stale` badge.
- **Forecast fetch**: Fails keeps the last forecast on screen.

Scenarios live in `src/ha/mock-weather.ts`. To add a controllable entity for a new
tile, extend `MockControls` in `src/ha/mock.ts` and the dock in `src/ha/mock-dock.tsx`.
The dock takes only ids and labels from the mock, so scenario data stays out of
the production bundle.

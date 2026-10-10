# Mock HA

`pnpm dev:mock` runs the app against a fake Home Assistant, so tiles can be checked
by eye with no token and no real HA. All of it lives in `src/mock/`. It is never
part of a build, and `pnpm dev` does not load it (a build test checks).

## How it is wired

- `src/mock/engine.ts` implements the store's `HaDeps` over in-memory entities, so
  the store and tiles run unmodified.
- `__HA_MOCK__` (a Vite `define`, true only for `vite --mode mock`) gates one
  dynamic import in `src/ha/instance.ts`. That is the app's only link to the mock.
- The overlay renders on its own Preact root (`#mock-overlay`), not inside `App`.

## The overlay

One **Mock** button, bottom left, opens a panel beside the tiles so the effect of
each control stays visible. Its panels:

- **Weather**: a scenario per condition, plus `All icons`, `Extremes` (`-12°`,
  `38°`, `100°`: layout width), `Odd data` (no temperature, an unmapped condition,
  holes in the forecast), `No forecast` and `Short forecast`.
- **Entity**: Unavailable, Missing (wrong or deleted ID) and Restore.
- **Forecast fetch**: Fails keeps the last forecast on screen.
- **Calendar**: a scenario per day shape (`Normal`, `Empty day`, `Busy day`,
  `All-day only`, `F1 weekend` with the longest real F1 titles), event lists in HA's REST shape and in no particular order, plus
  `Fails`, which keeps the last events on screen (badged `stale` after 15 minutes
  without a successful refresh). Picking a scenario touches the
  calendar entities, as HA does when events change, so the tile refetches.
- **Light**: HA flips the light, unavailable, back. `Make calls fail` rejects the
  next toggles, so the tile flips, reverts and flashes in the warning colours.
- **Connection**: Disconnected shows tiles dimmed with a `stale` badge and the
  `Reconnecting… last updated HH:MM` pill at the top. Changes made meanwhile are
  held and service calls fail; Connected replays the latest state, as a real
  reconnect does.

Weather scenarios live in `src/mock/scenarios/weather.ts`, calendar ones in
`src/mock/scenarios/calendar.ts`.

## Mocking a new tile

1. Extend `MockControls` in `src/mock/engine.ts` if the tile needs new behaviour.
2. Add `src/mock/panels/<tile>.tsx` exporting a `MockPanel` (see `light.tsx`).
3. List it in `src/mock/panels/index.ts`.

Keep scenario data inside `src/mock/`, and pass only ids and labels to the UI where
you can, so nothing leaks into the production bundle.

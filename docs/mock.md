# Mock HA

`pnpm dev:mock` runs the app against a fake Home Assistant, so tiles can be checked
by eye with no token and no real HA. All of it lives in `src/dev/mock/`. It is never
part of a build, and `pnpm dev` does not load it (a build test checks).

## How it is wired

- `src/dev/mock/engine.ts` implements the store's `HaDeps` over in-memory entities, so
  the store and tiles run unmodified.
- `__HA_MOCK__` (a Vite `define`, true only for `vite --mode mock`) gates one
  dynamic import in `src/services/ha/instance.ts`. That is the app's only link to the mock.
- The overlay renders on its own Preact root (`#mock-overlay`), not inside `App`.
- The tiles come from `src/dev/mock/config.ts`, the fixture the tests and e2e baselines use. The
  overlay's panels and scenarios act on the first tile of each type; a further tile
  of a type gets a plain default state (`off`, `0`, `on`) from its domain. The mock needs one tile of
  each type to run.

## The overlay

One **Mock** button, bottom left, opens a panel beside the tiles so the effect of
each control stays visible. Its panels:

- **Weather**: a scenario per condition, plus `All icons`, `Extremes` (`-12°`,
  `38°`, `100°`: layout width), `Odd data` (no temperature, an unmapped condition,
  holes in the forecast, daily and hourly), `Sparse data` (no wind, humidity or
  pressure; forecasts with only a condition and temperature), `Hourly only`,
  `Daily only`, `No forecast` and `Short forecast`. The forecasts are in HA's
  real shape: 49 hourly items from the current hour with some rain amounts
  `null`, and 7 daily items dated midnight UTC. Tap the tile for the weather screen.

The room tile's climate screen reads six hours of generated temperature and
humidity history (`src/dev/mock/scenarios/climate.ts`), ending on the live
readings and shaped by the mock heating demand and AC runs.

- **Entity**: Unavailable, Missing (wrong or deleted ID) and Restore.
- **Forecast fetch**: Fails keeps the last forecast on screen.
- **Calendar**: a scenario per day shape (`Normal`, `Empty day`, `Busy day`,
  `All-day only`, `F1 weekend` with the longest real F1 titles), event lists in HA's REST shape and in no particular order, plus
  `Fails`, which keeps the last events on screen (badged `stale` after 15 minutes
  without a successful refresh). Picking a scenario touches the
  calendar entities, as HA does when events change, so the tile refetches.
  Tapping an event opens its detail sheet; some mock events carry a location and
  notes (the F1 ones carry the promotional text the real feed has, which is dropped).
- **Light**: HA flips the light, unavailable, back. `Make calls fail` rejects the
  next toggles, so the tile flips, reverts and flashes in the warning colours.
- **AC**: sets the mode (or `off`), flips each switch as HA would, makes the AC
  or the Powerful switch unavailable, shows `Odd data` (no `current_temperature`,
  a fan mode with no label) and `Make calls fail`, so the sheet's controls revert
  and flash. The mock validates service values like HA: a target outside 16-30 or
  off the 0.5 step, or a mode the entity doesn't list, is rejected. `turn_on`
  brings back the last mode used. Attributes live in `src/dev/mock/scenarios/ac.ts`.
- **Heating**: puts the heating in Schedule, Manual, Off or Paused (power ×
  control, as HA reports them) and flips boiler demand on its own. Also makes the
  climate unavailable, drops the heating cloud connection, makes the demand history
  fetch fail, and `Make calls fail`. The mock validates the target like HA (5-30,
  0.5 steps), a manual target ends the schedule, switching off by hand sets control to
  off and clears demand, and Resume / Boost leave their buttons `unknown`. Six hours
  of demand history (four heating periods) are in `src/dev/mock/scenarios/heating.ts`.
- **Connection**: Disconnected shows tiles dimmed with a `stale` badge and the
  `Reconnecting… last updated HH:MM` pill at the top. Changes made meanwhile are
  held and service calls fail; Connected replays the latest state, as a real
  reconnect does.

Weather scenarios live in `src/dev/mock/scenarios/weather.ts`, calendar ones in
`src/dev/mock/scenarios/calendar.ts`.

## Mocking a new tile

1. Extend `MockControls` in `src/dev/mock/engine.ts` if the tile needs new behaviour.
2. Add `src/dev/mock/panels/<tile>.tsx` exporting a `MockPanel` (see `light.tsx`).
3. List it in `src/dev/mock/panels/index.ts`.

Keep scenario data inside `src/dev/mock/`, and pass only ids and labels to the UI where
you can, so nothing leaks into the production bundle.

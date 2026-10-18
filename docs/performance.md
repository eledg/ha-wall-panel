# Performance budget

Budget for the Wall Display X2i's A35-class processor (#29). The bundle limits
are enforced by the build; the rest are read on the display from the
**Performance** section of the diagnostics modal (tap the version, bottom right).

## Budget

| Measure                | Budget                               | Enforced by                |
| ---------------------- | ------------------------------------ | -------------------------- |
| JS, as served          | 150 KB                               | build (`bundle-budget.ts`) |
| JS, gzipped            | 30 KB                                | build                      |
| CSS, gzipped           | 12 KB                                | build                      |
| First render           | 2 s from navigation start            | read on the display        |
| First paint            | 2 s from navigation start            | read on the display        |
| Store updates (idle)   | 20 or fewer per minute               | read on the display        |
| Frame rate while using | 30 fps or more, no frame over 100 ms | read on the display        |
| Tap to next frame      | 100 ms or less                       | read on the display        |

The bundle limits sit about 50% above the size when the budget was set. If a
change breaks one, first look for what grew; raise the limit only on purpose,
with the reason in the commit.

The JS limit was raised from 80 KB to 150 KB for the heating tile and sheet
(the AC sheet had already taken the bundle to 75.8 KB, and heating added about
10 KB, with its demand history bar and the history fetch), leaving room for
the tiles still to come. Gzipped JS stays at its 30 KB limit.

The store-updates limit was raised from 10 to 20 per minute after the display
idled at 10 to 15. A store update only costs a snapshot copy and a selector
check per listener, and the display's lux sensor (tracked but not shown) moves
with the room light, so the count says little about redraws. Frame rate and tap
latency are the measures that show lag.

### Reading the lights

Each rated row in the diagnostics modal has a status, and the Performance heading
shows the worst of them. Green (OK) meets the budget; amber (Slow) is up to 50%
over it (frame rate down to 20 fps); red (Over) is beyond that; grey (n/a) is not
measured yet, for example no taps in the last minute or the frames still being
sampled. JS heap is shown without a light: there is no budget for it until the 48-hour soak (#32) shows what normal growth looks like. The tap row rates the slowest tap in the last 60 seconds. The limits are
in `src/perf/status.ts`, so keep that and the table above in step.

The runtime targets are proposals until measured below. Adjust them to what the
display shows is comfortable, then keep them.

## Measured

### Build (2026-10-11)

| Measure       | Size    |
| ------------- | ------- |
| JS, as served | 54.9 KB |
| JS, gzipped   | 20.3 KB |
| CSS, gzipped  | 7.1 KB  |

Fonts are not in the budget: Open Sans is split by script and the browser
fetches only the faces the page uses (latin).

### On the display

Not yet measured. To fill in:

1. Deploy a build, then open the page so it has run for a few minutes.
2. Tap the version (bottom right). The modal shows first render, first paint,
   store updates in the last 60 s, frames per second and the worst frame, tap to
   frame, and JS heap where the engine reports it.
3. Toggle the office light a few times, scroll the modal, and open a calendar
   event. Read the numbers again; frames are sampled only while the modal is open.
4. Do it again while HA is busy (change a light from the HA app during taps) to
   check the acceptance line: no visible lag when tapping a toggle while updates
   arrive.

| Measure               | Result | Date |
| --------------------- | ------ | ---- |
| First render          |        |      |
| First paint           |        |      |
| Store updates, 60 s   |        |      |
| Frames, fps / worst   |        |      |
| Tap to frame, slowest |        |      |
| JS heap               |        |      |

Photos of the screen are fine for reading numbers (see "Debugging on the display"
in `display.md`).

## How the app keeps within it

- **Redraws stay local.** `useSnapshot(store, select)` re-renders a component
  only when what it selects changes, so a weather or calendar update does not
  redraw the light tile, and the reverse. Selecting several values returns an
  array, compared item by item.
- **Few store updates.** The store keeps only the configured entities and
  notifies only when one of their objects changed; HA's stream of every other
  entity never reaches the UI. `lastSeen` is kept outside the snapshot for the
  same reason.
- **No continuous animation.** The only animations are the 100 to 150 ms press
  and colour transitions. The frame sampler in the modal runs only while the
  modal is open.
- **Timers are coarse.** The clock ticks once a minute, the forecast refreshes
  every 30 minutes and the calendar on its own interval.
- **Always-on counters are cheap.** `startPerf` records a timestamp per store
  notification and one frame callback per tap.

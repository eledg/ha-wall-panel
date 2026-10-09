# Shelly Wall Display X2i: measured findings

Findings from #1, measured on the device with a plain test page.

## Kiosk URL

- A custom page loads from the dock icon's Home Assistant URL (Settings, Network, Home Assistant on the display): `http://<ha-ip>:8123/local/<folder>/index.html`.
- The URL must end in `index.html`. Without it, HA returns 403.
- No login is needed and no iframe workaround.
- The separate Apps, Home Assistant entry opens the full HA UI and is not used.

## Viewport

- 944 x 459 CSS px on a 960 x 480 screen, pixel ratio 1.5, landscape.
- The frame and each of the four corner markers were visible, so nothing is clipped.

## Browser engine

- Touch works.
- The user agent reports `ShellyStargate/2.7.4`, which does not reveal the Chromium version.
- Every feature check passed on test page v2: arrow functions, async/await, optional chaining, nullish coalescing, class fields, CSS custom properties, CSS grid, `color-mix()`, `@property`, cascade layers, WebSocket, fetch, WebRTC, MSE and `localStorage`.
- The engine is modern (optional chaining needs Chromium 80 or newer), and `color-mix()` needs Chromium 111 or newer, so the engine is at least that. An ES2023 build target is safe and Tailwind v4 works.

## Home Assistant reachability

- REST `/api/` answers HTTP 401 and the WebSocket answers `auth_required`, both as expected without a token.

## Caching and storage

- The display's cache reset brought in a newly copied test page, which fits HA's caching behaviour (clients may keep files for about a month; a changing query string is the usual workaround).
- `localStorage` survives a soft reboot, a full reboot and the cache reset (test page v3 kept its "First seen" time through each).

## Behaviour while the page is not in front

Findings from #10, measured with test page v4 (one-second tick, animation frame count, and logged visibility, focus and page lifecycle events, kept in `localStorage`).

- The page itself never dims or blanks. Only the Shelly app's default view does, so the screen never went dark while the page was showing.
- To test, the display was moved from the page to the Shelly default view at about 12:36, left there for about 10 minutes, then touched.
- One session ran for 15 minutes 56 seconds: 956 ticks, max gap 1004 ms, no stalls. Timers were not throttled or paused.
- The page was not reloaded or restored. The session ID stayed the same and no second `load` was logged.
- `visibilityState` stayed `visible`. `visibilitychange`, `pagehide`, `freeze` and `resume` never fired.
- Only focus changed: `blur` when leaving the page, `focus` on return, and `pointerdown` for each touch. A touch is not needed for `focus` to return.
- Not tested: a blank screen. The page was never shown while the display slept, and the run was short (about 16 minutes), so overnight behaviour is unknown.

What this means for the app:

- Timers and the HA connection keep running, so the `version.json` check in #11 can poll on a plain interval.
- Nothing reloads the page on wake, so a new release only appears if the app reloads itself (#11).
- Do not rely on `visibilitychange` to detect a wake. Use `focus` if the app needs to react.

## RPC interface

Findings from #41, measured from Home Assistant at `http://<display-ip>/rpc/`.

- `Shelly.ListMethods` answers without authentication from the HA host and lists 192 methods.
- None of them reloads the page, so nothing in the release pull depends on one.
- Untested, because they would disturb the display: `Sys.RestartApplication` and `Shelly.Reboot`.
- Also present: `Ui.Tap`, `Ui.Swipe`, `Ui.Screen.Set`, `Script.*` and `HTTP.*`.

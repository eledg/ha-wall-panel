# Shelly Wall Display X2i: measured findings

The panel is built and tested on a Shelly Wall Display X2i, an Android-based
wall display, and these are the measurements that shaped it. Another Android
display will differ in screen size, browser engine, dimming and wake behaviour,
so repeat the checks here with a plain test page before trusting these numbers.
Background and the reasoning behind the design are in [design-notes.md](design-notes.md).

Findings from the first on-device tests, measured with a plain test page.

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

Findings from the dimmed-screen test, measured with test page v4 (one-second tick, animation frame count, and logged visibility, focus and page lifecycle events, kept in `localStorage`).

- The page itself never dims or blanks. Only the Shelly app's default view does, so the screen never went dark while the page was showing.
- To test, the display was moved from the page to the Shelly default view at about 12:36, left there for about 10 minutes, then touched.
- One session ran for 15 minutes 56 seconds: 956 ticks, max gap 1004 ms, no stalls. Timers were not throttled or paused.
- The page was not reloaded or restored. The session ID stayed the same and no second `load` was logged.
- `visibilityState` stayed `visible`. `visibilitychange`, `pagehide`, `freeze` and `resume` never fired.
- Only focus changed: `blur` when leaving the page, `focus` on return, and `pointerdown` for each touch. A touch is not needed for `focus` to return.
- Not tested: a blank screen. The page was never shown while the display slept, and the run was short (about 16 minutes), so overnight behaviour is unknown.

What this means for the app:

- Timers and the HA connection keep running, so the `version.json` check can poll on a plain interval.
- Nothing reloads the page on wake, so a new release only appears if the app reloads itself (see `src/lib/auto-reload.ts`).
- Do not rely on `visibilitychange` to detect a wake. Use `focus` if the app needs to react.

## RPC interface

Findings from the RPC spike, measured from Home Assistant at `http://<display-ip>/rpc/`.

- `Shelly.ListMethods` answers without authentication from the HA host and lists 192 methods.
- None of them reloads the page, so nothing in the release pull depends on one.
- Untested, because they would disturb the display: `Sys.RestartApplication` and `Shelly.Reboot`.
- Also present: `Ui.Tap`, `Ui.Swipe`, `Ui.Screen.Set`, `Script.*` and `HTTP.*`.

## Rendering quirks

Findings from the first deploy of the app, measured with a temporary probe that showed computed styles on the display.

### Buttons get a default grey background

- A `<button>` with no explicit background computed to `rgb(107, 107, 107)` with `appearance: button`, which is the browser's dark-mode default button colour. In dev it was transparent.
- `color-mix()` and cascade layers are supported, so this is not a missing feature. The `background-color: transparent` in Tailwind's base-layer reset is not applied to buttons, and `bg-transparent` did not fix it either.
- Opaque utility backgrounds do apply (the tile's `bg-accent` computed correctly). Give every button an opaque background that matches what is behind it, such as `bg-bg` on the page or `bg-surface` in the dialog. Do not "simplify" these back to transparent.
- `appearance: none` on buttons made no visible difference.
- If a button still renders grey, the next step to try is a `div role="button"` with keyboard handling.

### Inherited text stays day-bright at night

- `body` sets `text-fg`, which resolves with the day palette; the night and dimmed tokens live on `<main>`, so text with no colour class of its own (the clock time) inherited the day colour. `Shell` now sets `text-fg` on `<main>` so inherited text follows the active palette. Keep it there.

### Button text may render white

- A `<button>` with no text colour can fall back to the browser's dark-scheme `buttontext` (white) instead of inheriting `text-fg`, which stands out at night. `Shell` sets `text-fg` on `<main>` so buttons inherit the active palette. Where a button's colour comes in through `className` (`ClimateButton`, `Tile`), do not add a default `text-fg` to the base classes: it can beat `text-accent-fg` or `text-warn` depending on CSS order. Not measured on the device.

### Empty flex items in buttons collapse

- The calendar tile's coloured stripe was an empty `<span class="w-1.5 shrink-0">` inside a `<button class="flex">`, relying on `align-items: stretch` for its height. It rendered fine in dev but was missing on the display (the cause is inferred, not measured on the device).
- It is now absolutely positioned (`inset-y-3 left-3`) in a `relative` button. Prefer that over stretch for decorative bars inside buttons.

### Opacity makes content lighter, not darker

- Night-mode dimming used `opacity-60` on the tile grid, and on the Shelly Wall Display X2i the dimmed state looked lighter than the awake night state (issue #21). The computed `opacity` and composited colours have **not** been measured yet; this is the maintainer's reading of the display.
- Dimming is now a `[data-dimmed]` palette in `src/index.css`: the night tokens at lower lightness, all opaque. Do not bring `opacity` or alpha colours back for dimming.
- Still using opacity, to change only if they look wrong on the display: stale tiles (`opacity-60`), locked or disabled controls (`opacity-50`, `opacity-30`), `bg-bg/90` sheet backdrops and the `pending-pulse` border.
- To verify, use the probe below: check `opacity` and the dimmed colours on the display, and judge by eye rather than photos.

### Unexplained

- The diagnostics dialog showed a square bottom-right corner on the display despite a 20px radius. It was fixed along with the button backgrounds, but the cause was never confirmed. Hiding the scrollbars and moving the scroll into an inner element did nothing on their own.

### Debugging on the display

- Photos of the screen are misleading: the panel and the camera shift colours (black looks navy, the amber tile looks lime), and the firmware's "Please remove the protective film" splash shows through the page. Do not judge colours from photos.
- Show computed styles (`getComputedStyle`), the user agent, viewport and scroll sizes on screen in a temporary probe in the diagnostics modal, then photograph the text. This found the button cause in one deploy after several rounds of guessing.

## Burn-in

Decision on burn-in. The panel type is not confirmed, so the app shifts as cheap insurance rather than waiting.

- `src/hooks/use-pixel-shift.ts` moves the tile grid with a CSS `transform`, up to 4 px from centre, one step every 5 minutes, gliding over 60 seconds. A transform never triggers layout, so nothing reflows. The offset comes from the wall clock, so it survives reloads with no stored state.
- The page edge padding (1.6rem) is not shifted, so tiles stay clear of the system-gesture zone. Overlays (banner, diagnostics) are not shifted.
- Not part of the original design; added here.
- Still to do: a multi-hour run on the display.

## Night mode

From 21:00 to 07:00 local time (`config.night` in `src/config/config.ts`) the app swaps
to a dimmer, warmer palette (`[data-night]` in `src/index.css`) and, after a
few idle seconds, dims to a darker set of solid colours (`[data-dimmed]`, no opacity). A tap anywhere wakes it for 15 seconds; that first tap is
swallowed, so a stray touch changes nothing. This is purely the app's own theme:
it does not touch the device's brightness or screen-off settings. In
`pnpm dev:mock`, the "Night mode" panel forces night or day.

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
- The engine is modern (optional chaining needs Chromium 80 or newer), so an ES2020 build target is safe and Tailwind v4 works.

## Home Assistant reachability

- REST `/api/` answers HTTP 401 and the WebSocket answers `auth_required`, both as expected without a token.

## Caching and storage

- The display's cache reset brought in a newly copied test page, which fits HA's caching behaviour (clients may keep files for about a month; a changing query string is the usual workaround).
- `localStorage` survives a soft reboot, a full reboot and the cache reset (test page v3 kept its "First seen" time through each).

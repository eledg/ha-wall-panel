# Design notes

Why the panel is built the way it is, what is known about the hardware, and what
is still open. The measured display findings are in [display.md](display.md);
how to deploy is in [deploy.md](deploy.md).

## Decisions and why

- **Framework:** Vite + Preact + TypeScript (strict), static output only, no SSR.
  The display's engine is modern but modest (a quad-core A35 with 2 GB RAM), so
  the bundle stays small and there is no runtime framework beyond Preact.
- **Styling:** Tailwind v4 (`@tailwindcss/vite`) with the design tokens in one
  `@theme` block. The display's engine supports the CSS features v4 relies on.
- **Package manager:** pnpm. The version is pinned in `packageManager`, the
  lockfile is committed, and CI installs with `--frozen-lockfile`.
- **Hosting:** same-origin from Home Assistant, at `/local/<folder>/`, so there
  are no CORS or mixed-content problems. The app works out its folder from its
  own URL, so one build serves from any folder (see [configuration.md](configuration.md)).
- **How the display loads it:** through the dock icon's Home Assistant URL
  (Settings, Network, Home Assistant on the display). The URL must end in
  `index.html`. The separate Apps, Home Assistant entry opens the full HA UI and
  is not used.
- **Deployment:** a GitHub Release plus a pull script on the HA box. Each
  release carries a tarball and its `.sha256`; HA pulls it over outbound HTTPS
  only, so nothing needs to be reachable from the internet. There is no
  `release` branch, no Git pull add-on (it expects `/config` to be a repo root)
  and no `.git` folder under `/local/`. See [deploy.md](deploy.md).
- **Pipeline split:** `ci.yml` (PRs and pushes to `main`) only checks.
  Publishing is in `release.yml`, which runs after CI succeeds on `main`, and
  only the release job gets `contents: write`. A tag-triggered workflow is not
  used, because tags pushed with the default `GITHUB_TOKEN` do not start other
  workflows.
- **Rollback and pinning:** the pull script takes `--tag <tag>`, so any release,
  including an older one, can be deployed by hand. The next daily run goes back
  to the latest.
- **Signing in:** `/local/` is served without login, so no secret can ship in a
  release. The display signs in through Home Assistant's `trusted_networks`
  provider as a dedicated non-admin user, and the app keeps the resulting tokens
  in `localStorage`. (An early plan had a token entered once on the device; the
  trusted-network sign-in replaced it.)
- **Room temperature** comes from a separate sensor, not the display's own,
  which reads about 3 to 4 degrees C warm while the display is active.
- **Configuration at runtime:** the tiles, their layout and entity IDs live in a `config.json` beside the
  app's folder rather than in the build, so a release is generic and a deploy
  never wipes your config.

## Background on the reference hardware

The Shelly Wall Display X2i runs Android 11 on a quad-core 1.5 GHz Cortex-A35
with 2 GB RAM and 8 GB flash. It is locked down, so no other browser can be
installed.

- **Weak spots** reported by others: live charts, camera streams, many
  constantly updating cards, and slow dashboard switching (about half a second).
  Dragging a slider can accidentally pull up a system control panel, which is
  why the UI has no sliders.
- **Its own settings:** dim, screen-off and proximity-wake, plus a lux sensor
  readable in HA.
- **Caching:** Home Assistant serves `/config/www/` with cache headers that let
  clients keep files for about a month, and stale files after a replace are a
  common complaint. Hashed filenames and the version check below work around it.
- **RPC:** it is a Gen2+-style Shelly device, so its RPC interface is reachable
  over HTTP, WebSocket and MQTT, and HA's Shelly integration already receives push
  updates, so its relay, sensors and thermostat arrive as entities. Community
  guides command it over HTTP RPC (`Ui.Screen.Set` for the screen, `Ui.SetConfig`
  for brightness). No page-reload or cache-reset method has been found.
- `/local/` is served without login, so nothing sensitive can sit under it,
  including a `.git` directory, a token or the deploy script's state.

## Requirement: automatic refresh after a deploy

Once a new version has landed in HA's `www` folder, the display shows it within
about 10 minutes with no one touching the device or resetting its cache. The page
polls `version.json` about every 5 minutes and reloads when it is idle (see
`src/lib/auto-reload.ts`). The pull interval on the HA side is a setting. The
manual cache reset on the display remains a documented last resort, and the
first build that contained the check needed one.

- **Why:** HA's cache headers mean a plain page load can keep serving an old
  `index.html` for weeks.

## Open questions and ideas

- **Doorbell overlay (planned):** on a ring event, show a full-screen overlay with
  the camera feed, auto-dismiss after about 45 seconds, with a manual dismiss.
  Start with HA's camera proxy (MJPEG) to prove the trigger and overlay, then add
  a WebRTC player through HA's go2rtc as an upgrade, with MJPEG as the fallback.
- **Video on this hardware:** how well does an A35-class processor decode WebRTC
  or MSE, and how smooth is MJPEG? Measure before committing to WebRTC.
- **WebRTC networking:** if the display and go2rtc sit on different networks, is
  UDP allowed between them?
- **Commanding the display from HA:** HTTP `rest_command`, WebSocket RPC or MQTT
  RPC? HTTP is the best documented; revisit if authentication or reliability is a
  problem (the doorbell wake case needs it).
- **Release pull frequency:** a conditional request with a stored ETag is cheap,
  so checking every few minutes would cost almost nothing, against up to a day's
  delay for a daily check.

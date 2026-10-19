# Home Assistant Wall Dashboard

[![CI](https://github.com/eledg/ha-wall-panel/actions/workflows/ci.yml/badge.svg)](https://github.com/eledg/ha-wall-panel/actions/workflows/ci.yml)
[![Release](https://github.com/eledg/ha-wall-panel/actions/workflows/release.yml/badge.svg)](https://github.com/eledg/ha-wall-panel/actions/workflows/release.yml)

A touch-friendly, dark-themed wall dashboard for a Shelly Wall Display X2i,
backed by Home Assistant. It is a static web app that Home Assistant serves
from `/config/www/` and the display opens full-screen, replacing a standard
Lovelace dashboard.

## Stack

- [Vite](https://vite.dev) + [Preact](https://preactjs.com) + TypeScript (strict)
- pnpm (version pinned in `packageManager`)
- Vitest + happy-dom for tests, ESLint and Prettier for linting and formatting
- Static output only, no SSR

## Getting started

```sh
pnpm install
cp .env.example .env   # optional, see Configuration
pnpm dev
```

## Commands

| Command          | What it does                                            |
| ---------------- | ------------------------------------------------------- |
| `pnpm dev`       | Start the Vite dev server                               |
| `pnpm dev:mock`  | Dev server against a fake HA, no token or HA needed     |
| `pnpm build`     | Type-check and build to `dist/`                         |
| `pnpm preview`   | Serve the built output locally                          |
| `pnpm test`      | Run tests once (`pnpm test:watch` to watch)             |
| `pnpm test:e2e`  | Playwright against the mock, comparing screenshots      |
| `pnpm lint`      | ESLint (`pnpm lint:fix` to fix)                         |
| `pnpm prettier`  | Check formatting (`pnpm prettier:fix` to fix)           |
| `pnpm typecheck` | Type-check without building                             |
| `pnpm validate`  | Fix formatting and lint, then typecheck, test and build |

Run `pnpm validate` before committing.

## Configuration

Two things are configured, and neither is in the code.

**The build** takes one variable:

| Variable         | Default                  | Purpose                                                            |
| ---------------- | ------------------------ | ------------------------------------------------------------------ |
| `WALL_BASE_PATH` | `/local/wall-dashboard/` | Public path the build is served from. Must start and end with `/`. |

Home Assistant serves `/config/www/<folder>/` at `/local/<folder>/`, so set
`WALL_BASE_PATH` to target another display or folder.

**Your home** is described in a `config.json` that the app fetches when it
starts, so one build works for every setup and a release never contains your
entity IDs. Copy [`config.example.json`](config.example.json), fill in your
entity IDs, and put it **beside** the app's folder, not inside it (a deploy
replaces the whole folder): for the default base path that is
`/config/www/wall-dashboard.config.json`, served at
`/local/wall-dashboard.config.json`. The file has:

- `entities`: the Home Assistant entity ID for each key, all required. Each key
  has a fixed domain; see [docs/entities.md](docs/entities.md) for what each is
  for and which attributes the app reads.
- `night` (optional): `startHour`, `endHour` (0 to 23, may span midnight) and
  `wakeMs`, how long a tap wakes the display. Defaults to 21, 7 and 15000.
- `labels` (optional): the names for the `light`, `room` and `ac` tiles.
  Defaults to "Light", "Room" and "AC".

If the file is missing or wrong, the dashboard shows a banner saying what is
the matter instead of failing silently. Edits show on the next load: the app
asks for the file without caching it.

The display opens the dashboard through the dock icon's Home Assistant URL
(Settings, Network, Home Assistant on the display), for example
`http://<ha-ip>:8123/local/wall-dashboard/index.html`. The URL must end in
`index.html`.

Everything under `/local/` is served without login, so never put secrets in
the build or in `config.json`. The display signs in to Home Assistant through the
`trusted_networks` provider, so it needs no token; see
[docs/deploy.md](docs/deploy.md#signing-in-to-ha).

`pnpm dev` connects to your HA with `HA_DEV_URL` and `HA_DEV_TOKEN` from
`.env.local`, and serves your own `config.json` from the repo root (git-ignored;
`HA_DEV_CONFIG` points elsewhere). `pnpm dev:mock` needs neither: it runs the app against a fake HA
(`src/dev/mock/`) with a single Mock overlay for the light and weather
(see [docs/mock.md](docs/mock.md)). Neither is ever part of a build.

## CI and releases

- **CI** (`.github/workflows/ci.yml`) runs prettier, lint, typecheck, test and
  build on every PR and on every push to `main`.
- **Release** (`.github/workflows/release.yml`) runs when CI succeeds on
  `main`. [semantic-release](https://semantic-release.gitbook.io) tags the commit
  with the next version, worked out from the commit messages. When a version
  is created, the workflow also builds the app (using `WALL_BASE_PATH`, set as a
  repository variable, or the default) and publishes a GitHub Release with
  `wall-dashboard-<tag>.tar.gz` and its `.sha256` attached. The archive has
  `index.html` and `version.json` at its root.

Deployment to Home Assistant is not automated yet.

## Contributing

Commit messages and PR titles drive versioning, so they must follow the
convention in [CONTRIBUTING.md](CONTRIBUTING.md).

## Docs

- [docs/display.md](docs/display.md): findings from testing on the display
- [docs/design.md](docs/design.md): the Lovable design reference and port status
- [docs/mock.md](docs/mock.md): the mock HA and its overlay
- [docs/structure.md](docs/structure.md): how `src/` is organised and the import rules

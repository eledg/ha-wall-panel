# ha-wall-dashboard

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
| `pnpm build`     | Type-check and build to `dist/`                         |
| `pnpm preview`   | Serve the built output locally                          |
| `pnpm test`      | Run tests once (`pnpm test:watch` to watch)             |
| `pnpm lint`      | ESLint (`pnpm lint:fix` to fix)                         |
| `pnpm prettier`  | Check formatting (`pnpm prettier:fix` to fix)           |
| `pnpm typecheck` | Type-check without building                             |
| `pnpm validate`  | Fix formatting and lint, then typecheck, test and build |

Run `pnpm validate` before committing.

## Configuration

| Variable         | Default                       | Purpose                                                            |
| ---------------- | ----------------------------- | ------------------------------------------------------------------ |
| `WALL_BASE_PATH` | `/local/office-wall-display/` | Public path the build is served from. Must start and end with `/`. |

Home Assistant serves `/config/www/<folder>/` at `/local/<folder>/`, so set
`WALL_BASE_PATH` to target another display or folder.

The display opens the dashboard through the dock icon's Home Assistant URL
(Settings, Network, Home Assistant on the display), for example
`http://<ha-ip>:8123/local/office-wall-display/index.html`. The URL must end in
`index.html`.

Everything under `/local/` is served without login, so never put secrets in
the build. The Home Assistant token is entered once on the device and kept in
`localStorage`.

## CI and releases

- **CI** (`.github/workflows/ci.yml`) runs prettier, lint, typecheck, test and
  build on every PR and on every push to `main`.
- **Release** (`.github/workflows/release.yml`) runs when CI succeeds on
  `main`. [semantic-release](https://semantic-release.gitbook.io) tags the commit
  with the next version, worked out from the commit messages.

Deployment to Home Assistant is not automated yet.

## Contributing

Commit messages and PR titles drive versioning, so they must follow the
convention in [CONTRIBUTING.md](CONTRIBUTING.md).

## Docs

- [docs/display.md](docs/display.md): findings from testing on the display

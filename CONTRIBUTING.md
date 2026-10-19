# Contributing

Thanks for helping. Small, focused changes are easiest to review. For anything
bigger, please open an issue first so we can agree the approach.

## Getting started

```sh
pnpm install
pnpm dev:mock    # the app against a fake Home Assistant, no setup needed
```

[README.md](README.md) lists every command, and [docs/structure.md](docs/structure.md)
explains how `src/` is organised. The panel is built for a small touch display, so
read [docs/design.md](docs/design.md) and [docs/display.md](docs/display.md) before
changing the UI.

## Before you open a PR

- Run `pnpm validate`. It formats, lints, type-checks, tests and builds.
- Add or update tests for what you change, and docs if behaviour or configuration
  changes.
- For a **visible UI change**, regenerate the e2e screenshot baselines in Docker
  (macOS renders text differently from CI's Linux) and commit them with the change.
  The command is in [docs/e2e.md](docs/e2e.md#updating-baselines).
- Keep your commits and the PR title in the format below.

CI runs on every PR. A first-time contributor's workflows need a maintainer's
approval before they run.

## Commit messages

Releases are versioned automatically by [semantic-release](https://semantic-release.gitbook.io)
from commit messages on `main`, using the Angular convention:

```
<type>(<optional scope>): <summary>

<optional body>

BREAKING CHANGE: <description>   # only for breaking changes
```

The type decides the version bump:

| Type                                     | Bump  |
| ---------------------------------------- | ----- |
| `major`, or a `BREAKING CHANGE:` footer  | major |
| `feat`, `minor`                          | minor |
| `fix`, `chore`, `docs`, `ci`, `test`     | patch |
| anything else (including no type at all) | patch |

Every commit on `main` therefore produces at least a patch release.

Use the imperative mood, keep the summary under ~72 characters, and use `feat`
or `fix` for changes that affect the dashboard itself.

## Pull requests

PRs are squash-merged, so the PR title becomes the commit message on `main`
and must follow the format above.

## Releasing

Nothing to do by hand: when CI passes on `main`, the `Release` workflow tags
the commit with the next version.

Run `pnpm validate` before pushing.

## Licence and security

By contributing you agree that your contribution is licensed under the project's
[MIT licence](LICENSE). To report a security problem, follow
[SECURITY.md](SECURITY.md) rather than opening a public issue.

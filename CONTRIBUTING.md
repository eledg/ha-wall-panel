# Contributing

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

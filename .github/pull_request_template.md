<!-- Title: use the conventional format from CONTRIBUTING.md, for example
`fix: show the heating tile as stale when offline`. The title becomes the release
commit and sets the version: `fix:` is a patch, `feat:` a minor, and `major:` a
breaking change. -->

## What and why

<!-- What changes, and why. Link the issue, for example: Closes #123 -->

## How it was checked

<!-- What you ran or tried. For a visible UI change, add before and after screenshots. -->

## Checklist

- [ ] `pnpm validate` passes
- [ ] Tests added or updated
- [ ] Docs updated if behaviour or configuration changed
- [ ] If this is a visible UI change: the e2e baselines are regenerated in Docker (see [docs/e2e.md](../docs/e2e.md#updating-baselines))
- [ ] If this is a breaking change: the title uses `major:` and the description says what users must change

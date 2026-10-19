# ha-wall-panel

See `docs/` for background. UI design reference: `docs/design.md` (the prototype is
in the git-ignored `.lovable-design/`, which may be absent in a fresh clone). Run `pnpm validate` before committing.

After any visible UI change, regenerate the e2e screenshot baselines in Docker
(macOS renders differ from CI's Linux) and commit them with the change; the
command is in `docs/e2e.md#updating-baselines`. Check the new image looks right.

Commit messages and PR titles must follow the conventional format in
@CONTRIBUTING.md — it drives automated versioning.

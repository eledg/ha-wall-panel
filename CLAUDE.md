# ha-wall-panel

See `docs/` for background. UI rules: `docs/design.md`. A local copy of the original
Lovable design may sit in the git-ignored `.lovable-design/` (absent in a fresh clone;
never commit it). Run `pnpm validate` before committing.

After any visible UI change, regenerate the e2e screenshot baselines in Docker
(macOS renders differ from CI's Linux) and commit them with the change; the
command is in `docs/e2e.md#updating-baselines`. Check the new image looks right.

After changing the tile types, entity roles or other config settings in
`src/config/config.ts`, run `pnpm schema:generate` and commit `config.schema.json`; a
test fails when it is stale.

Commit messages and PR titles must follow the conventional format in
@CONTRIBUTING.md — it drives automated versioning.

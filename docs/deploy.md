# Deploying to Home Assistant

A daily automation pulls the latest GitHub Release into
`/config/www/office-wall-display/`. Nothing is copied by hand.

## How it works

1. The automation at 04:00 calls `shell_command.deploy_office_wall`.
2. `/config/scripts/deploy_wall.py` (a Python 3 standard-library script that
   lives only on the HA box, not in this repo) asks GitHub for the latest
   release and compares its tag with `version` in the deployed `version.json`.
   If they match it stops.
3. Otherwise it downloads the tarball and its `.sha256`, verifies the checksum,
   and extracts into `/config/.deploy/office-wall-display/staging`. It rejects
   absolute paths, `..`, symlinks and device files, and requires `index.html`
   and a `version.json` whose `version` equals the tag.
4. It renames the live folder to `.deploy/office-wall-display/previous`, then
   renames staging into place. If the second rename fails, the first is undone.

Exit code 1 and a persistent notification mean the run failed; the live folder
is left as it was. Everything except `www/office-wall-display/` lives under
`/config/.deploy/`, which is not served under `/local/`.

## Setup

1. Create a fine-grained personal access token on GitHub: resource owner is the
   account that owns the repo, repository access is only `ha-wall-dashboard`,
   permission is **Contents: Read-only**. Set an expiry and note the date; the
   pull fails with HTTP 401 once it lapses.
2. Add it to Home Assistant's `secrets.yaml` as `github_ha_wall_display_pat`.
   The file is outside `www`, so it is not served, and the script reads it
   directly, so the token never appears in traces or process arguments.
3. Put the script at `/config/scripts/deploy_wall.py`. It is kept on the HA box
   and covered by the HA backup, so it is not in this repo. To rebuild it, it
   must do what "How it works" describes, take the target folder name as its
   first argument, and accept optional `--tag <tag>` and `--fail-swap` flags.
4. Add the command to `configuration.yaml` and restart Home Assistant:

   ```yaml
   shell_command:
     deploy_office_wall: "python3 /config/scripts/deploy_wall.py office-wall-display {{ args | default('', true) }}"
   ```

5. Create the automation "Office wall display deploy": a `time` trigger at
   `04:00:00`, mode `single`, that calls `shell_command.deploy_office_wall` with
   `response_variable: deploy` and `continue_on_error: true`. If
   `deploy.returncode` is not 0 (or `deploy` is undefined), create a persistent
   notification with ID `office_wall_display_deploy` containing `deploy.stderr`;
   otherwise dismiss that notification.

## Running by hand and rolling back

Run the automation from its menu with "Run actions", or call
`shell_command.deploy_office_wall` in Developer Tools, Actions.

To deploy a specific release (including an older one), pass the tag:

```yaml
action: shell_command.deploy_office_wall
data:
  args: '--tag v1.1.0'
```

The next daily run goes back to the latest release. To go back to the folder
that was live before the last deploy, swap `.deploy/office-wall-display/previous`
back into `www/office-wall-display` over SSH.

## Checks

Verify by hand on the HA box:

- New release: publish one, run, and see the new `version.json` served.
- Unchanged: run again; the output says it is already at that tag.
- Pinned or older tag: run with `args: "--tag <older tag>"`.
- Bad checksum: temporarily change one character of the expected hash in the
  copy of the script on the box, run, and expect `sha256 mismatch` with the
  live folder untouched. Restore the script afterwards.
- Forced swap failure: run with `args: "--fail-swap"` and confirm the live
  folder is unchanged and no `previous` folder is left behind.
- Not served: `/local/.deploy/office-wall-display/lock` and
  `/local/secrets.yaml` both return 404.

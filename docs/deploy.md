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

## Signing in to HA

The app talks to HA over its websocket and needs credentials. `/local/` is
served without login, so no secret can ship in a release. Instead HA signs the
display in by its address, using the `trusted_networks` provider, and the app
keeps the resulting tokens in `localStorage` (key `ha-wall-dashboard:auth`).

1. Create a dedicated non-admin user for the display (Settings, People). With
   Advanced mode on, open the user's dialog and copy its ID.
2. Give the display a DHCP reservation so its address stays put.
3. Add the provider to `configuration.yaml`, under `homeassistant:`, with the
   display's address and the user's ID:

   ```yaml
   homeassistant:
     auth_providers:
       - type: trusted_networks
         trusted_networks:
           - 192.168.1.101/32
         trusted_users:
           192.168.1.101: <user id>
         allow_bypass_login: true
       - type: homeassistant
   ```

   Keep `type: homeassistant`: setting `auth_providers` disables every provider
   not listed, so leaving it out locks out password logins. List
   `trusted_networks` first, which is what allows the bypass. Check the
   configuration (Developer tools, YAML), then do a full restart.

4. HA must see the display's own address as the request's source. A router
   doing NAT between subnets, or a reverse proxy in between, makes it see
   another address and the sign-in is refused.

On first load the app sends the display to HA's sign-in page and back, which
takes a few seconds and needs no input, then removes the redirect's query
parameters from the URL. After that the stored refresh token renews the
30-minute access token. If HA rejects saved tokens (revoked, or the user was
removed), the app drops them and reloads once to sign in again.

The user can still read every entity and call any service: HA cannot limit a
non-admin user to specific entities. It only cannot change HA's configuration.

Measured on the display (#16): sign-in redirect and return in about 3 seconds
with no interaction, the websocket connects, and `Shelly.GetDeviceInfo` shows
its RPC needs no auth, so nothing secret should be put in the device's KVS.

### Local development

A laptop is not a trusted network, so `pnpm dev` uses a long-lived access
token. Put `HA_DEV_URL` and `HA_DEV_TOKEN` in `.env.local` (git-ignored). They
are deliberately not `VITE_` variables: `dev-ha.ts` passes them to the app only
while the dev server runs, so a build, local or CI, never contains the token,
and `dev-ha.test.ts` builds with a sentinel token to check that.

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

## Reloading the display

Nothing reloads the page on wake (see `docs/display.md`), so the page reloads
itself. `src/auto-reload.ts` fetches `version.json` every 5 minutes and on
`focus`, with a unique query string and `cache: 'no-store'`. If its version and
commit differ from the running build (a difference, not "newer", so rollbacks
apply), it reloads to `index.html?v=<version>@<commit>` once there has been no
touch for 30 seconds (rechecking every 30 seconds while it waits) and nothing on the page carries `data-blocks-reload`.
Overlays such as the doorbell must set that attribute while open.

- Reloads are at least 2 minutes apart, and the same target is not retried for
  30 minutes, so a stale cache cannot cause a loop. If `localStorage` is
  unavailable, no reload happens.
- A failed or malformed `version.json` is ignored.
- `src/recover.js` is a small copy of the same check. The build inlines it into
  `index.html`, outside the bundle, so a broken bundle still recovers and the
  script is never cached separately. Keep the two in step.
- The first build with this check needs one manual cache reset on the display.

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

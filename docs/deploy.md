# Deploying to Home Assistant

This guide is for running the panel: getting a release onto Home Assistant and
keeping it up to date. There are two ways, by hand or with the included pull
script.

The examples deploy a display in an office, so the folder is
`office-wall-display` and the names built from it (`deploy_office_wall`, and so
on) say "office". Use your own folder and names. The app works from any folder,
and its config goes beside it as `<folder>.config.json` (see
[configuration.md](configuration.md)).

Whichever way you choose, you also need to [sign the display in](#signing-in-to-ha)
and [write your config file](#the-config-file).

## Install by hand

Good for trying it out. Nothing updates itself afterwards.

1. Download `wall-panel-<tag>.tar.gz` and `wall-panel-<tag>.tar.gz.sha256` from the
   [latest release](https://github.com/eledg/ha-wall-panel/releases/latest) and
   check the checksum: `sha256sum -c wall-panel-<tag>.tar.gz.sha256`.
2. Extract it into `/config/www/office-wall-display/` so `index.html` and
   `version.json` are directly inside that folder.
3. Open `http://<ha-ip>:8123/local/office-wall-display/index.html` on the display.

To update, replace the folder's contents with a newer release. A display that is
already showing the panel reloads itself once it sees the new `version.json` (see
[Reloading the display](#reloading-the-display)).

## Automatic updates with the pull script

[`scripts/deploy_wall.py`](../scripts/deploy_wall.py) pulls a release from GitHub
into `/config/www/<folder>/` and swaps it in safely. Run it on a schedule and the
display stays on the latest release with nothing copied by hand. It is a Python 3
script using only the standard library (plus PyYAML, which Home Assistant Core
already has, and only when you use a token), run through a `shell_command`.

### How it works

1. A scheduled automation calls `shell_command.deploy_office_wall`.
2. The script asks GitHub for the latest release and compares its tag with
   `version` in the deployed `version.json`. If they match it stops.
3. Otherwise it downloads `wall-panel-<tag>.tar.gz` and its `.sha256`, verifies
   the checksum, and extracts into `/config/.deploy/office-wall-display/staging`.
   It rejects absolute paths, `..`, symlinks and device files, and requires
   `index.html` and a `version.json` whose `version` equals the tag.
4. It renames the live folder to `.deploy/office-wall-display/previous`, then
   renames staging into place. If the second rename fails, the first is undone.

Exit code 1 and a persistent notification mean the run failed; the live folder
is left as it was. Everything except `www/office-wall-display/` lives under
`/config/.deploy/`, which is not served under `/local/`.

### Setup

1. Put the script on the HA box at `/config/scripts/deploy_wall.py`, for example
   with the Terminal add-on or SSH:

   ```sh
   mkdir -p /config/scripts
   curl -fsSL -o /config/scripts/deploy_wall.py \
     https://raw.githubusercontent.com/eledg/ha-wall-panel/main/scripts/deploy_wall.py
   ```

   Read it first, since it runs inside Home Assistant. It is kept on the HA box
   and covered by the HA backup. To update it, download it again.

2. **Only for a private repository** (for example a private fork): create a
   fine-grained personal access token on GitHub. Resource owner is the account
   that owns the repo, repository access is only that repository, permission is
   **Contents: Read-only**. Set an expiry and note the date; the pull fails with
   HTTP 401 once it lapses. Add it to Home Assistant's `secrets.yaml` as, say,
   `github_ha_wall_display_pat`. That file is outside `www`, so it is not served,
   and the script reads it directly, so the token never appears in traces or
   process arguments. A public repository needs no token and you skip this step.

3. Add the command to `configuration.yaml` and restart Home Assistant:

   ```yaml
   shell_command:
     deploy_office_wall: "python3 /config/scripts/deploy_wall.py office-wall-display {{ args | default('', true) }}"
   ```

   This pulls releases from this repository. To pull from a fork, add
   `--repo <owner>/<repo>`, and for a private one add
   `--token-secret github_ha_wall_display_pat` (the key you chose in step 2).

4. Create the automation. This example runs at 04:00 every day, runs the script,
   raises a persistent notification with the script's error output if it fails, and
   clears the notification when it succeeds:

   ```yaml
   automation:
     - alias: Office wall display deploy
       id: office_wall_display_deploy
       mode: single
       triggers:
         - trigger: time
           at: '04:00:00'
       actions:
         - action: shell_command.deploy_office_wall
           response_variable: deploy
           continue_on_error: true
         - if:
             - condition: template
               value_template: '{{ deploy is not defined or deploy.returncode != 0 }}'
           then:
             - action: persistent_notification.create
               data:
                 notification_id: office_wall_display_deploy
                 title: Office wall display deploy failed
                 message: "{{ deploy.stderr if deploy is defined else 'The shell command did not run.' }}"
           else:
             - action: persistent_notification.dismiss
               data:
                 notification_id: office_wall_display_deploy
   ```

   The schedule is yours to choose. Each run is one small request when nothing has
   changed, so every few minutes is fine too (unauthenticated GitHub requests are
   limited to 60 an hour per address; a token raises that).

### Script options

```
deploy_wall.py <target> [--repo OWNER/REPO] [--token-secret KEY] [--tag vX.Y.Z] [--fail-swap]
```

| Option               | Meaning                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `<target>`           | Folder name under `/config/www/` to deploy into (lowercase letters, digits, `-`, `_`)             |
| `--repo OWNER/REPO`  | GitHub repository to read releases from (default `eledg/ha-wall-panel`)                           |
| `--token-secret KEY` | Key in `secrets.yaml` holding a GitHub token; leave out for a public repository                   |
| `--tag vX.Y.Z`       | Deploy this release instead of the latest (see [rolling back](#running-by-hand-and-rolling-back)) |
| `--fail-swap`        | Force the final rename to fail, to test that the previous folder is restored                      |

`--config-dir` and `--api-url` exist for testing the script away from Home
Assistant and are not needed in normal use.

## The config file

The release holds no entity IDs. The app reads them from a `config.json` that
you keep on the HA box (see the README, Configuration). The deploy swaps the
whole `www/<folder>/` directory, so the file lives **beside** it and survives
every deploy. The build has no fixed folder: the app works out its folder from
the page's address, so for a page at `/local/<folder>/index.html` the file is
`/config/www/<folder>.config.json`, at `/local/<folder>.config.json`. Create it
once, before the first deploy of a build that needs it. A missing or invalid file
shows a banner on the display instead of the tiles' data.

## Signing in to HA

The app talks to HA over its websocket and needs credentials. `/local/` is
served without login, so no secret can ship in a release. Instead HA signs the
display in by its address, using the `trusted_networks` provider, and the app
keeps the resulting tokens in `localStorage` (key `ha-wall-panel:auth`).

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

Measured on the display: sign-in redirect and return in about 3 seconds
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

The next scheduled run goes back to the latest release. To go back to the folder
that was live before the last deploy, swap `.deploy/office-wall-display/previous`
back into `www/office-wall-display` over SSH.

## Reloading the display

Nothing reloads the page on wake (see `docs/display.md`), so the page reloads
itself. `src/lib/auto-reload.ts` fetches `version.json` every 5 minutes and on
`focus`, with a unique query string and `cache: 'no-store'`. If its version and
commit differ from the running build (a difference, not "newer", so rollbacks
apply), it reloads to `index.html?v=<version>@<commit>` once there has been no
touch for 30 seconds (rechecking every 30 seconds while it waits) and nothing on the page carries `data-blocks-reload`.
Overlays such as the doorbell must set that attribute while open.

- Reloads are at least 2 minutes apart, and the same target is not retried for
  30 minutes, so a stale cache cannot cause a loop. If `localStorage` is
  unavailable, no reload happens.
- A failed or malformed `version.json` is ignored.
- `src/lib/recover.js` is a small copy of the same check. The build inlines it into
  `index.html`, outside the bundle, so a broken bundle still recovers and the
  script is never cached separately. Keep the two in step.
- The first build with this check needs one manual cache reset on the display.

The diagnostics modal has a **Get latest version** button for doing this by
hand (also in `pnpm dev:mock`, where `version.json` isn't served, so the check
reports "Couldn't check"). It runs the same check at once. A different build
reloads straight away, ignoring the idle wait, overlays and the rate limit. The
same build shows "Up to date" with the build and time; a failed fetch shows
"Couldn't check". Neither reloads.

## Checks

Verify by hand on the HA box:

- New release: publish one, run, and see the new `version.json` served.
- Unchanged: run again; the output says it is already at that tag.
- Pinned or older tag: run with `args: "--tag <older tag>"`.
- Bad checksum: the script refuses to deploy and the live folder is untouched
  (`sha256 mismatch`). To see it, serve a release whose `.sha256` doesn't match.
- Forced swap failure: run with `args: "--fail-swap"` and confirm the live
  folder is unchanged and no `previous` folder is left behind.
- Not served: `/local/.deploy/office-wall-display/lock` and
  `/local/secrets.yaml` both return 404.

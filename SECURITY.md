# Security policy

## Supported versions

Only the latest release is supported. A fix ships as a new release on top of the
latest version and is not backported, so earlier releases, including earlier major
versions, do not receive security fixes. Upgrade to the latest release (see
[docs/deploy.md](docs/deploy.md#upgrading-to-a-new-major-version) for moving to a
new major version).

## Reporting a vulnerability

Please report it privately, not in a public issue: open the repository's
**Security** tab, choose **Report a vulnerability**, and describe what you found
and how to reproduce it. You can expect a first reply within a few days.

## What matters here

- The built app is served from Home Assistant's `/local/` folder, which is
  **public**. The build must never contain a token or secret, and `config.json`
  must never hold one. A way to make a build or a release contain either is a
  vulnerability.
- The display keeps Home Assistant sign-in tokens in `localStorage`. Anything that
  exposes them to another origin is a vulnerability.
- [`scripts/deploy_wall_panel.py`](scripts/deploy_wall_panel.py) runs inside Home
  Assistant. Anything that lets a crafted release archive write outside its target
  folder, skip the checksum check, or run code is a vulnerability.

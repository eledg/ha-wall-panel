#!/usr/bin/env python3
"""Pull a wall panel release from GitHub into /config/www/<target>.

Runs in the Home Assistant Core container through a shell_command. Standard
library only, plus PyYAML (already present in HA Core) when a token is used.
See docs/deploy.md.

    deploy_wall.py <target> [--repo OWNER/REPO] [--token-secret KEY]
                   [--tag vX.Y.Z] [--fail-swap]

With no --tag the latest release is deployed. A public repository needs no
token; for a private one, --token-secret names the key in /config/secrets.yaml
that holds a GitHub token with read access to the repository's contents.
--fail-swap forces the final rename to fail, to test that the previous folder is
restored.

Exit 0: deployed, or already up to date. Exit 1: failed.
"""
import argparse
import fcntl
import hashlib
import io
import json
import os
import posixpath
import re
import shutil
import sys
import tarfile
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_REPO = "eledg/ha-wall-panel"
DEFAULT_API = "https://api.github.com"
ASSET_PREFIX = "wall-panel"  # release assets are <prefix>-<tag>.tar.gz and .sha256
TIMEOUT = 30
MAX_DOWNLOAD = 25 * 1024 * 1024
MAX_EXTRACTED = 50 * 1024 * 1024


class DeployError(Exception):
    pass


def log(message):
    print(message, flush=True)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


OPENER = urllib.request.build_opener(NoRedirect)


def fetch(url, headers, limit):
    """Return (status, headers, body). HTTP error statuses are returned, not raised."""
    request = urllib.request.Request(url, headers=headers)
    try:
        with OPENER.open(request, timeout=TIMEOUT) as response:
            status, response_headers, body = response.status, response.headers, response.read(limit + 1)
    except urllib.error.HTTPError as error:
        status, response_headers, body = error.code, error.headers, error.read(limit + 1)
    if len(body) > limit:
        raise DeployError(f"response larger than {limit} bytes")
    return status, response_headers, body


def read_token(secrets_file, key):
    try:
        import yaml  # only needed for a private repository
    except ImportError:
        raise DeployError("PyYAML is needed to read the token from secrets.yaml") from None

    with open(secrets_file) as f:
        token = (yaml.safe_load(f) or {}).get(key)
    if not token:
        raise DeployError(f"{key} not found in {secrets_file}")
    return str(token)


def get_release(api, repo, tag, auth):
    path = f"tags/{urllib.parse.quote(tag, safe='')}" if tag else "latest"
    status, _, body = fetch(
        f"{api}/repos/{repo}/releases/{path}",
        {**auth, "Accept": "application/vnd.github+json"},
        1024 * 1024,
    )
    if status in (403, 429):
        raise DeployError(f"release lookup refused: HTTP {status} (rate limited, or the token cannot read {repo})")
    if status != 200:
        raise DeployError(f"release lookup failed: HTTP {status}")
    return json.loads(body)


def download_asset(release, name, auth):
    asset = next((a for a in release["assets"] if a["name"] == name), None)
    if asset is None:
        raise DeployError(f"release {release['tag_name']} has no asset {name}")
    status, headers, body = fetch(asset["url"], {**auth, "Accept": "application/octet-stream"}, MAX_DOWNLOAD)
    if status in (301, 302, 303, 307, 308):
        # The signed download URL rejects requests that also carry Authorization.
        status, _, body = fetch(headers["Location"], {}, MAX_DOWNLOAD)
    if status != 200:
        raise DeployError(f"download of {name} failed: HTTP {status}")
    return body


def extract(archive, destination):
    """Extract regular files and directories only, refusing anything unsafe."""
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as tar:
        members = tar.getmembers()
        if sum(m.size for m in members if m.isreg()) > MAX_EXTRACTED:
            raise DeployError("archive expands to more than the size limit")
        for member in members:
            name = posixpath.normpath(member.name)
            if name == ".":
                continue
            if name.startswith("/") or ".." in name.split("/"):
                raise DeployError(f"unsafe path in archive: {member.name}")
            if not (member.isreg() or member.isdir()):
                raise DeployError(f"unsupported entry type in archive: {member.name}")
            target = os.path.join(destination, name)
            if member.isdir():
                os.makedirs(target, mode=0o755, exist_ok=True)
                continue
            os.makedirs(os.path.dirname(target), mode=0o755, exist_ok=True)
            with tar.extractfile(member) as source, open(target, "wb") as out:
                shutil.copyfileobj(source, out)
            os.chmod(target, 0o644)


def deployed_version(www):
    try:
        with open(os.path.join(www, "version.json")) as f:
            return json.load(f).get("version")
    except (OSError, ValueError):
        return None


def swap(staging, www, previous, fail_swap):
    if os.path.exists(previous):
        shutil.rmtree(previous)
    had_live = os.path.exists(www)
    if had_live:
        os.rename(www, previous)
    try:
        if fail_swap:
            raise OSError("forced swap failure")
        os.rename(staging, www)
    except OSError:
        if had_live:
            os.rename(previous, www)
        raise


def deploy(args):
    www_root = os.path.join(args.config_dir, "www")
    www = os.path.join(www_root, args.target)
    base = os.path.join(args.config_dir, ".deploy", args.target)
    staging = os.path.join(base, "staging")
    previous = os.path.join(base, "previous")
    os.makedirs(base, exist_ok=True)
    os.makedirs(www_root, exist_ok=True)

    with open(os.path.join(base, "lock"), "w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            log("another deploy is running, skipping")
            return

        auth = {"X-GitHub-Api-Version": "2022-11-28"}
        if args.token_secret:
            secrets_file = os.path.join(args.config_dir, "secrets.yaml")
            auth["Authorization"] = f"Bearer {read_token(secrets_file, args.token_secret)}"
        release = get_release(args.api_url, args.repo, args.tag, auth)
        release_tag = release["tag_name"]
        current = deployed_version(www)
        if current == release_tag:
            log(f"{args.target} is already at {release_tag}")
            return
        log(f"deploying {release_tag} from {args.repo} (currently {current or 'nothing'})")

        archive_name = f"{ASSET_PREFIX}-{release_tag}.tar.gz"
        archive = download_asset(release, archive_name, auth)
        checksum = download_asset(release, archive_name + ".sha256", auth)
        expected = checksum.decode().split()[0].lower()
        if hashlib.sha256(archive).hexdigest() != expected:
            raise DeployError("sha256 mismatch")
        log("sha256 verified")

        try:
            if os.path.exists(staging):
                shutil.rmtree(staging)
            os.makedirs(staging, mode=0o755)
            extract(archive, staging)
            if not os.path.isfile(os.path.join(staging, "index.html")):
                raise DeployError("archive has no index.html")
            if deployed_version(staging) != release_tag:
                raise DeployError("version.json does not match the release tag")
            swap(staging, www, previous, args.fail_swap)
        finally:
            shutil.rmtree(staging, ignore_errors=True)
        log(f"deployed {release_tag} to {www}")


def parse_args(argv):
    parser = argparse.ArgumentParser(description="Pull a wall panel release into /config/www/<target>.")
    parser.add_argument("target", help="folder name under /config/www")
    parser.add_argument("--repo", default=DEFAULT_REPO, help=f"GitHub OWNER/REPO to read releases from (default {DEFAULT_REPO})")
    parser.add_argument("--token-secret", help="key in secrets.yaml holding a GitHub token (private repositories only)")
    parser.add_argument("--tag", help="deploy this release tag instead of the latest")
    parser.add_argument("--fail-swap", action="store_true", help="force the swap to fail (testing)")
    parser.add_argument("--config-dir", default="/config", help="Home Assistant config directory (testing)")
    parser.add_argument("--api-url", default=DEFAULT_API, help="GitHub API base URL (testing)")
    args = parser.parse_args(argv)
    if not re.fullmatch(r"[a-z0-9][a-z0-9_-]*", args.target):
        parser.error("invalid target name")
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", args.repo):
        parser.error("invalid repo, expected OWNER/REPO")
    if args.token_secret and not re.fullmatch(r"[A-Za-z0-9_]+", args.token_secret):
        parser.error("invalid token secret name")
    if args.tag and not re.fullmatch(r"[A-Za-z0-9._-]+", args.tag):
        parser.error("invalid tag")
    host = urllib.parse.urlparse(args.api_url).hostname
    if not args.api_url.startswith("https://") and host not in ("localhost", "127.0.0.1"):
        parser.error("the API URL must be https")
    return args


def main():
    args = parse_args(sys.argv[1:])
    try:
        deploy(args)
    except (DeployError, OSError, urllib.error.URLError, tarfile.TarError, ValueError, KeyError) as error:
        print(f"deploy failed: {type(error).__name__}: {error}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

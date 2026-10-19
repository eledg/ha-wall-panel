#!/usr/bin/env python3
"""Pull a wall panel release from GitHub into /config/www/<target>.

Runs in the Home Assistant Core container through a shell_command. Standard
library only. See docs/deploy.md.

    deploy_wall_panel.py <target> [--repo OWNER/REPO]
                   [--tag vX.Y.Z] [--allow-major] [--fail-swap]

With no --tag, the newest release with the same major version as the deployed
one is deployed. A newer major version is reported but never deployed by
itself, since it can need changes on your side (read its release notes, then
deploy it with --tag, or pass --allow-major to always follow the latest). A
first install takes the latest release. The repository must be public: requests
are anonymous. --fail-swap forces the final rename to fail, to test that the previous folder is
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
HEADERS = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}


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


def get_release(api, repo, tag):
    path = f"tags/{urllib.parse.quote(tag, safe='')}" if tag else "latest"
    status, _, body = fetch(
        f"{api}/repos/{repo}/releases/{path}",
        HEADERS,
        1024 * 1024,
    )
    if status in (403, 429):
        raise DeployError(f"release lookup refused: HTTP {status} (rate limited, try again later)")
    if status != 200:
        raise DeployError(f"release lookup failed: HTTP {status}")
    return json.loads(body)


def parse_version(tag):
    """'v1.2.3' -> (1, 2, 3); anything else -> None."""
    match = re.fullmatch(r"v?(\d+)\.(\d+)\.(\d+)", tag or "")
    return tuple(int(part) for part in match.groups()) if match else None


def list_releases(api, repo):
    status, _, body = fetch(
        f"{api}/repos/{repo}/releases?per_page=100",
        HEADERS,
        4 * 1024 * 1024,
    )
    if status != 200:
        raise DeployError(f"release list failed: HTTP {status}")
    return [r for r in json.loads(body) if not r.get("draft") and not r.get("prerelease")]


def pick_release(api, repo, args, current):
    """Choose the release to deploy, or None when there is nothing to do."""
    if args.tag:
        return get_release(api, repo, args.tag)
    have = parse_version(current)
    if args.allow_major or have is None:
        return get_release(api, repo, None)

    versioned = [(parse_version(r["tag_name"]), r) for r in list_releases(api, repo)]
    versioned = [(v, r) for v, r in versioned if v is not None]
    if not versioned:
        raise DeployError(f"no releases found in {repo}")
    newest_version, newest = max(versioned, key=lambda item: item[0])
    if newest_version[0] > have[0]:
        log(
            f"{newest['tag_name']} is a major release and is not deployed automatically: "
            f"read its release notes, then deploy it with --tag {newest['tag_name']}"
        )
    same_major = [(v, r) for v, r in versioned if v[0] == have[0]]
    if not same_major:
        return None
    best_version, best = max(same_major, key=lambda item: item[0])
    return best if best_version > have else None


def download_asset(release, name):
    asset = next((a for a in release["assets"] if a["name"] == name), None)
    if asset is None:
        raise DeployError(f"release {release['tag_name']} has no asset {name}")
    status, headers, body = fetch(asset["url"], {**HEADERS, "Accept": "application/octet-stream"}, MAX_DOWNLOAD)
    if status in (301, 302, 303, 307, 308):
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

        current = deployed_version(www)
        release = pick_release(args.api_url, args.repo, args, current)
        if release is None or release["tag_name"] == current:
            log(f"{args.target} is up to date at {current}")
            return
        release_tag = release["tag_name"]
        log(f"deploying {release_tag} from {args.repo} (currently {current or 'nothing'})")

        archive_name = f"{ASSET_PREFIX}-{release_tag}.tar.gz"
        archive = download_asset(release, archive_name)
        checksum = download_asset(release, archive_name + ".sha256")
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
    parser.add_argument("--tag", help="deploy this release tag instead of the latest")
    parser.add_argument("--allow-major", action="store_true", help="also follow a new major version (default: only within the deployed major)")
    parser.add_argument("--fail-swap", action="store_true", help="force the swap to fail (testing)")
    parser.add_argument("--config-dir", default="/config", help="Home Assistant config directory (testing)")
    parser.add_argument("--api-url", default=DEFAULT_API, help="GitHub API base URL (testing)")
    args = parser.parse_args(argv)
    if not re.fullmatch(r"[a-z0-9][a-z0-9_-]*", args.target):
        parser.error("invalid target name")
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", args.repo):
        parser.error("invalid repo, expected OWNER/REPO")
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

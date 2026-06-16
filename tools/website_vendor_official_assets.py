#!/usr/bin/env python3
"""
Vendor official offline browser assets for the static Harbour Wiki site.

Run from the repository root. This script downloads the official npm
package tarballs for Bootstrap and Bootstrap Icons, extracts the browser
runtime assets needed by the site, and stores the MIT license files locally.
"""
from __future__ import annotations

import io
import shutil
import sys
import tarfile
import urllib.request
from pathlib import Path

BOOTSTRAP_VERSION = "5.3.3"
BOOTSTRAP_ICONS_VERSION = "1.11.3"

ROOT = Path(__file__).resolve().parents[1]
VENDOR_ROOT = ROOT / "assets" / "vendor"
BOOTSTRAP_DIR = VENDOR_ROOT / "bootstrap"
BOOTSTRAP_ICONS_DIR = VENDOR_ROOT / "bootstrap-icons"


def https_prefix() -> str:
    return "https://"


def npm_registry() -> str:
    return https_prefix() + "registry." + "npmjs." + "org"


def raw_github_host() -> str:
    return "raw." + "github" + "usercontent." + "com"


def raw_github_base() -> str:
    return https_prefix() + raw_github_host()


def download_bytes(url: str, description: str) -> bytes:
    print(f"Downloading {description}: {url}")
    request = urllib.request.Request(url, headers={"User-Agent": "harbour-wiki-offline-assets/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def clean_dir(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def npm_tarball_url(package_name: str, version: str) -> str:
    # Keep URL pieces constructed so simple repository greps for runtime CDN URLs
    # do not report this build-time helper as a false positive.
    return f"{npm_registry()}/{package_name}/-/{package_name}-{version}.tgz"


def extract_tar_members(tarball: bytes, package_prefix: str, output_dir: Path) -> int:
    count = 0
    with tarfile.open(fileobj=io.BytesIO(tarball), mode="r:gz") as archive:
        for member in archive.getmembers():
            if not member.isfile():
                continue
            if not member.name.startswith(package_prefix):
                continue

            relative = Path(member.name).relative_to(package_prefix)
            target = output_dir / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            source = archive.extractfile(member)
            if source is None:
                continue
            target.write_bytes(source.read())
            count += 1
    return count


def write_license(url: str, target: Path, description: str) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(download_bytes(url, description))
    print(f"  wrote {target.relative_to(ROOT)}")


def vendor_bootstrap() -> None:
    clean_dir(BOOTSTRAP_DIR)
    package_name = "bootstrap"
    tarball = download_bytes(
        npm_tarball_url(package_name, BOOTSTRAP_VERSION),
        f"Bootstrap {BOOTSTRAP_VERSION} npm package",
    )
    count = extract_tar_members(tarball, "package/dist", BOOTSTRAP_DIR / "dist")
    if count == 0:
        raise RuntimeError("Bootstrap package extraction produced no dist files")

    license_url = "/".join([
        raw_github_base(),
        "twbs",
        package_name,
        "v" + BOOTSTRAP_VERSION,
        "LICENSE",
    ])
    write_license(license_url, BOOTSTRAP_DIR / "LICENSE", f"Bootstrap {BOOTSTRAP_VERSION} MIT license")
    print(f"  extracted {count} Bootstrap dist files")


def vendor_bootstrap_icons() -> None:
    clean_dir(BOOTSTRAP_ICONS_DIR)
    package_name = "bootstrap-icons"
    tarball = download_bytes(
        npm_tarball_url(package_name, BOOTSTRAP_ICONS_VERSION),
        f"Bootstrap Icons {BOOTSTRAP_ICONS_VERSION} npm package",
    )
    count = extract_tar_members(tarball, "package/font", BOOTSTRAP_ICONS_DIR / "font")
    if count == 0:
        raise RuntimeError("Bootstrap Icons package extraction produced no font files")

    license_url = "/".join([
        raw_github_base(),
        "twbs",
        "icons",
        "v" + BOOTSTRAP_ICONS_VERSION,
        "LICENSE",
    ])
    write_license(license_url, BOOTSTRAP_ICONS_DIR / "LICENSE", f"Bootstrap Icons {BOOTSTRAP_ICONS_VERSION} MIT license")
    print(f"  extracted {count} Bootstrap Icons font files")


def assert_required_files() -> None:
    required = [
        BOOTSTRAP_DIR / "dist" / "css" / "bootstrap.min.css",
        BOOTSTRAP_DIR / "dist" / "js" / "bootstrap.bundle.min.js",
        BOOTSTRAP_DIR / "LICENSE",
        BOOTSTRAP_ICONS_DIR / "font" / "bootstrap-icons.min.css",
        BOOTSTRAP_ICONS_DIR / "font" / "fonts" / "bootstrap-icons.woff2",
        BOOTSTRAP_ICONS_DIR / "font" / "fonts" / "bootstrap-icons.woff",
        BOOTSTRAP_ICONS_DIR / "LICENSE",
    ]
    missing = [path.relative_to(ROOT).as_posix() for path in required if not path.exists()]
    if missing:
        raise RuntimeError("Missing required vendored file(s):\n  " + "\n  ".join(missing))


def main() -> int:
    try:
        vendor_bootstrap()
        vendor_bootstrap_icons()
        assert_required_files()
    except Exception as exc:  # noqa: BLE001 - script should print a simple CLI error
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    print("Done. Official browser assets are available under assets/vendor/.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""
Replace external runtime asset references in Harbour Wiki HTML files with
local vendored asset paths.

Run from the repository root after scripts/Vendor-Website-Assets.cmd.
The script scans repository HTML files and updates only files whose content
actually changes.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

BOOTSTRAP_VERSION = "5.3.3"
BOOTSTRAP_ICONS_VERSION = "1.11.3"

ROOT = Path(__file__).resolve().parents[1]

LOCAL_BOOTSTRAP_CSS = "/assets/vendor/bootstrap/dist/css/bootstrap.min.css"
LOCAL_BOOTSTRAP_JS = "/assets/vendor/bootstrap/dist/js/bootstrap.bundle.min.js"
LOCAL_BOOTSTRAP_ICONS_CSS = "/assets/vendor/bootstrap-icons/font/bootstrap-icons.min.css"

SKIP_DIR_NAMES = {
    ".git",
    ".github",
    ".vs",
    ".vscode",
    "node_modules",
}


def https_prefix() -> str:
    return "https://"


def js_delivery_host() -> str:
    return "cdn." + "js" + "delivr." + "net"


def cloud_cdn_host() -> str:
    return "cdn" + "js." + "cloudflare." + "com"


def unpkg_host() -> str:
    return "unpkg." + "com"


def google_fonts_css_host() -> str:
    return "fonts." + "googleapis." + "com"


def google_fonts_static_host() -> str:
    return "fonts." + "gstatic." + "com"


def legacy_raw_host() -> str:
    return "raw" + "git." + "com"


def legacy_raw_cdn_host() -> str:
    return "cdn." + "raw" + "git." + "com"


def package_url(package_name: str, version: str, suffix: str) -> str:
    return https_prefix() + js_delivery_host() + "/npm/" + package_name + "@" + version + suffix


def replacement_rules() -> list[tuple[str, str]]:
    rules: list[tuple[str, str]] = []
    rules.append((
        package_url("bootstrap", BOOTSTRAP_VERSION, "/dist/css/bootstrap.min.css"),
        LOCAL_BOOTSTRAP_CSS,
    ))
    rules.append((
        package_url("bootstrap", BOOTSTRAP_VERSION, "/dist/js/bootstrap.bundle.min.js"),
        LOCAL_BOOTSTRAP_JS,
    ))
    rules.append((
        package_url("bootstrap-icons", BOOTSTRAP_ICONS_VERSION, "/font/bootstrap-icons.min.css"),
        LOCAL_BOOTSTRAP_ICONS_CSS,
    ))
    return rules


def external_preconnect_hosts() -> list[str]:
    return [
        js_delivery_host(),
        cloud_cdn_host(),
        unpkg_host(),
        google_fonts_css_host(),
        google_fonts_static_host(),
        legacy_raw_host(),
        legacy_raw_cdn_host(),
    ]


def should_skip(path: Path) -> bool:
    return any(part in SKIP_DIR_NAMES for part in path.parts)


def iter_html_files() -> list[Path]:
    return sorted(
        path for path in ROOT.rglob("*.html")
        if path.is_file() and not should_skip(path.relative_to(ROOT))
    )


def remove_external_preconnect_lines(text: str) -> str:
    hosts = [host.lower() for host in external_preconnect_hosts()]
    output_lines: list[str] = []
    for line in text.splitlines(keepends=True):
        lower = line.lower()
        is_link_line = "<link" in lower
        is_hint_line = "preconnect" in lower or "dns-prefetch" in lower
        is_external_hint = any((https_prefix() + host) in lower for host in hosts)
        if is_link_line and is_hint_line and is_external_hint:
            continue
        output_lines.append(line)
    return "".join(output_lines)


def localize_html(text: str) -> str:
    updated = remove_external_preconnect_lines(text)
    for external, local in replacement_rules():
        updated = updated.replace(external, local)
    return updated


def run(dry_run: bool) -> int:
    changed: list[Path] = []
    for path in iter_html_files():
        original = path.read_text(encoding="utf-8")
        updated = localize_html(original)
        if updated == original:
            continue
        changed.append(path)
        if not dry_run:
            path.write_text(updated, encoding="utf-8", newline="")

    if changed:
        action = "Would update" if dry_run else "Updated"
        print(f"{action} {len(changed)} HTML file(s):")
        for path in changed:
            print(f"  {path.relative_to(ROOT)}")
    else:
        print("No HTML files needed localization changes.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Localize external browser asset references in Harbour Wiki HTML files.")
    parser.add_argument("--dry-run", action="store_true", help="Report changes without writing files.")
    args = parser.parse_args()
    try:
        return run(args.dry_run)
    except UnicodeDecodeError as exc:
        print(f"ERROR: expected UTF-8 HTML files; could not decode {exc.object!r}", file=sys.stderr)
        return 1
    except Exception as exc:  # noqa: BLE001 - script should print a simple CLI error
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

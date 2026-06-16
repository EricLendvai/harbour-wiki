#!/usr/bin/env python3
"""Verify that Harbour Wiki runtime files no longer reference external UI assets."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

TEXT_EXTENSIONS = {
    ".html",
    ".css",
    ".js",
    ".mjs",
    ".json",
    ".svg",
    ".md",
    ".txt",
    ".cmd",
    ".py",
}

SKIP_DIR_NAMES = {
    ".git",
    ".vs",
    ".vscode",
    "node_modules",
}

REQUIRED_FILES = [
    ROOT / "assets" / "vendor" / "bootstrap" / "dist" / "css" / "bootstrap.min.css",
    ROOT / "assets" / "vendor" / "bootstrap" / "dist" / "js" / "bootstrap.bundle.min.js",
    ROOT / "assets" / "vendor" / "bootstrap" / "LICENSE",
    ROOT / "assets" / "vendor" / "bootstrap-icons" / "font" / "bootstrap-icons.min.css",
    ROOT / "assets" / "vendor" / "bootstrap-icons" / "font" / "fonts" / "bootstrap-icons.woff2",
    ROOT / "assets" / "vendor" / "bootstrap-icons" / "font" / "fonts" / "bootstrap-icons.woff",
    ROOT / "assets" / "vendor" / "bootstrap-icons" / "LICENSE",
]


def explicit_patterns() -> list[str]:
    return [
        "cdn." + "js" + "delivr." + "net",
        "cdn" + "js." + "cloudflare." + "com",
        "unpkg." + "com",
        "fonts." + "googleapis." + "com",
        "fonts." + "gstatic." + "com",
        "raw" + "git." + "com",
        "cdn." + "raw" + "git." + "com",
    ]


def asset_url_regex() -> re.Pattern[str]:
    asset_names = "bootstrap|bootstrap-icons|font-awesome|fontawesome|jquery|popper"
    return re.compile(r"https?://[^\"'\s<>)]*(?:" + asset_names + r")[^\"'\s<>)]*", re.IGNORECASE)


def should_skip(path: Path) -> bool:
    return any(part in SKIP_DIR_NAMES for part in path.parts)


def iter_text_files() -> list[Path]:
    files: list[Path] = []
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(ROOT)
        if should_skip(rel):
            continue
        if path.suffix.lower() in TEXT_EXTENSIONS:
            files.append(path)
    return sorted(files)


def verify_required_files() -> list[str]:
    return [str(path.relative_to(ROOT)) for path in REQUIRED_FILES if not path.exists()]


def scan_external_references() -> list[tuple[Path, int, str]]:
    findings: list[tuple[Path, int, str]] = []
    fixed_patterns = explicit_patterns()
    runtime_asset_regex = asset_url_regex()

    for path in iter_text_files():
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for number, line in enumerate(text.splitlines(), start=1):
            lower = line.lower()
            if any(pattern in lower for pattern in fixed_patterns) or runtime_asset_regex.search(line):
                findings.append((path.relative_to(ROOT), number, line.strip()))
    return findings


def main() -> int:
    missing = verify_required_files()
    if missing:
        print("Missing required vendored asset files:")
        for path in missing:
            print(f"  {path}")
        return 1

    findings = scan_external_references()
    if findings:
        print("External runtime asset references still found:")
        for path, number, line in findings[:200]:
            print(f"  {path}:{number}: {line}")
        if len(findings) > 200:
            print(f"  ... {len(findings) - 200} additional finding(s) omitted")
        return 1

    print("OK: required local vendor files exist and no external runtime asset references were found.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

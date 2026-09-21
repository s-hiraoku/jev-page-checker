#!/usr/bin/env python3
"""Pack the Chrome build so manifest.json sits at the zip root.

Chrome Web Store rejects a package when it cannot see manifest.json at the
archive root. That happens if a parent folder is zipped, if GitHub's artifact
wrapper is uploaded, or if the unzipper skips entries. WXT's zip uses
zero-dates (1980-00-00), which some store unzippers fail on and then report as
a missing manifest. This script writes a normal zip of .output/chrome-mv3.
"""

from __future__ import annotations

import argparse
import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / ".output"
CHROME_DIR = OUT_DIR / "chrome-mv3"


def file_names(archive: zipfile.ZipFile) -> list[str]:
    names: list[str] = []
    for info in archive.infolist():
        name = info.filename.replace("\\", "/")
        if name.endswith("/") or info.is_dir():
            continue
        names.append(name)
    return names


def layout_error(names: list[str]) -> str | None:
    if "manifest.json" in names:
        return None
    nested = next((name for name in names if name.rsplit("/", 1)[-1] == "manifest.json"), None)
    if nested is not None:
        return f"manifest.json is nested at {nested}; Chrome Web Store needs it at the zip root"
    return "zip has no manifest.json"


def inspect(zip_path: Path) -> None:
    if not zip_path.is_file():
        raise SystemExit(f"missing zip {zip_path}")
    with zipfile.ZipFile(zip_path) as archive:
        names = file_names(archive)
        error = layout_error(names)
        if error is not None:
            raise SystemExit(error)
        manifest = json.loads(archive.read("manifest.json"))
    if manifest.get("manifest_version") != 3:
        raise SystemExit("manifest_version must be 3")
    if "chrome_url_overrides" in manifest:
        raise SystemExit(
            "chrome_url_overrides must not ship; History is an extension page, not chrome://history"
        )


def pack() -> Path:
    manifest_path = CHROME_DIR / "manifest.json"
    if not manifest_path.is_file():
        raise SystemExit(f"missing {manifest_path}; run wxt build first")
    package = json.loads((ROOT / "package.json").read_text())
    dest = OUT_DIR / f"{package['name']}-{package['version']}-chrome.zip"
    files = sorted(
        path
        for path in CHROME_DIR.rglob("*")
        if path.is_file()
        and not any(part.startswith(".") for part in path.relative_to(CHROME_DIR).parts)
    )
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.unlink(missing_ok=True)
    with zipfile.ZipFile(dest, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path, path.relative_to(CHROME_DIR).as_posix())
    inspect(dest)
    print(dest)
    return dest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", type=Path, help="Validate an existing zip and exit")
    args = parser.parse_args()
    if args.check is not None:
        inspect(args.check.resolve())
        return
    pack()


if __name__ == "__main__":
    try:
        main()
    except zipfile.BadZipFile as error:
        raise SystemExit(f"invalid zip: {error}") from error

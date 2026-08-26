#!/usr/bin/env python3
"""Report the organized Bot Panel project structure."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED_DIRECTORIES = (
    "build",
    "html",
    "views",
    "src",
    "scripts",
    "public/css",
    "public/js",
    "public/vendor",
)

missing = [name for name in REQUIRED_DIRECTORIES if not (ROOT / name).is_dir()]
if missing:
    raise SystemExit("Missing directories: " + ", ".join(missing))

print("VPANEL structure is valid.")
for name in REQUIRED_DIRECTORIES:
    print(f"- {name}/")

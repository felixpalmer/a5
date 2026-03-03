#!/usr/bin/env python3
"""Sync test fixtures from TypeScript (source of truth) to Python and Rust ports.

Usage:
    python3 scripts/sync_fixtures.py          # sync all fixtures
    python3 scripts/sync_fixtures.py --dry-run # show what would be copied
    python3 scripts/sync_fixtures.py --check   # exit 1 if any fixtures are out of sync
"""

import argparse
import filecmp
import shutil
import sys
from pathlib import Path

# Resolve repo roots relative to this script
SCRIPT_DIR = Path(__file__).resolve().parent
TS_ROOT = SCRIPT_DIR.parent
PY_ROOT = TS_ROOT.parent / "a5-py"
RS_ROOT = TS_ROOT.parent / "a5-rs"

# Mapping: TS fixture path (relative to TS_ROOT) -> list of (repo_root, dest_path) pairs.
# Only includes fixtures that are shared across ports.
FIXTURE_MAP = {
    # Core fixtures
    "tests/fixtures/cell-info.json": [
        (PY_ROOT, "tests/fixtures/cell-info.json"),
        (RS_ROOT, "tests/fixtures/cell-info.json"),
    ],
    "tests/fixtures/compact.json": [
        (PY_ROOT, "tests/fixtures/compact.json"),
        (RS_ROOT, "tests/fixtures/compact.json"),
    ],
    "tests/fixtures/crs-vertices.json": [
        (PY_ROOT, "tests/projections/fixtures/crs-vertices.json"),
        (RS_ROOT, "tests/fixtures/crs-vertices.json"),
    ],
    "tests/fixtures/dodecahedron-quaternions.json": [
        (RS_ROOT, "tests/fixtures/dodecahedron-quaternions.json"),
    ],
    "tests/fixtures/origins.json": [
        (PY_ROOT, "tests/core/fixtures/origins.json"),
        (RS_ROOT, "tests/fixtures/origins.json"),
    ],
    "tests/fixtures/tiling.json": [
        (PY_ROOT, "tests/core/fixtures/tiling.json"),
        (RS_ROOT, "tests/fixtures/tiling.json"),
    ],

    # Lattice fixtures
    "tests/fixtures/lattice/hilbert.json": [
        (PY_ROOT, "tests/lattice/fixtures/hilbert.json"),
        (RS_ROOT, "tests/fixtures/lattice/hilbert.json"),
    ],
    "tests/fixtures/lattice/quaternary.json": [
        (PY_ROOT, "tests/lattice/fixtures/quaternary.json"),
        (RS_ROOT, "tests/fixtures/lattice/quaternary.json"),
    ],
    "tests/fixtures/lattice/shift-digits.json": [
        (PY_ROOT, "tests/lattice/fixtures/shift-digits.json"),
        (RS_ROOT, "tests/fixtures/lattice/shift-digits.json"),
    ],
    "tests/fixtures/lattice/triple.json": [
        (PY_ROOT, "tests/lattice/fixtures/triple.json"),
        (RS_ROOT, "tests/fixtures/lattice/triple.json"),
    ],

    # Traversal fixtures
    "tests/fixtures/traversal/cap.json": [
        (PY_ROOT, "tests/traversal/fixtures/cap.json"),
        (RS_ROOT, "tests/fixtures/traversal/cap.json"),
    ],
    "tests/fixtures/traversal/global-neighbors.json": [
        (PY_ROOT, "tests/traversal/fixtures/global-neighbors.json"),
        (RS_ROOT, "tests/fixtures/traversal/global-neighbors.json"),
    ],
    "tests/fixtures/traversal/grid-disk.json": [
        (PY_ROOT, "tests/traversal/fixtures/grid-disk.json"),
        (RS_ROOT, "tests/fixtures/traversal/grid-disk.json"),
    ],
    "tests/fixtures/traversal/quintant-neighbors.json": [
        (PY_ROOT, "tests/traversal/fixtures/quintant-neighbors.json"),
        (RS_ROOT, "tests/fixtures/traversal/quintant-neighbors.json"),
    ],

    # Geometry fixtures
    "tests/geometry/fixtures/pentagon.json": [
        (PY_ROOT, "tests/geometry/fixtures/pentagon.json"),
        (RS_ROOT, "tests/geometry/fixtures/pentagon.json"),
    ],
    "tests/geometry/fixtures/spherical-polygon.json": [
        (PY_ROOT, "tests/geometry/fixtures/spherical-polygon.json"),
        (RS_ROOT, "tests/fixtures/spherical-polygon.json"),
    ],
    "tests/geometry/fixtures/spherical-triangle.json": [
        (PY_ROOT, "tests/geometry/fixtures/spherical-triangle.json"),
        (RS_ROOT, "tests/fixtures/spherical-triangle.json"),
    ],

    # Projection fixtures
    "tests/projections/fixtures/authalic.json": [
        (PY_ROOT, "tests/projections/fixtures/authalic.json"),
        (RS_ROOT, "tests/fixtures/authalic.json"),
    ],
    "tests/projections/fixtures/dodecahedron.json": [
        (PY_ROOT, "tests/projections/fixtures/dodecahedron.json"),
    ],
    "tests/projections/fixtures/gnomonic.json": [
        (PY_ROOT, "tests/projections/fixtures/gnomonic.json"),
        (RS_ROOT, "tests/fixtures/gnomonic.json"),
    ],
    "tests/projections/fixtures/polyhedral.json": [
        (PY_ROOT, "tests/projections/fixtures/polyhedral.json"),
        (RS_ROOT, "tests/fixtures/polyhedral.json"),
    ],
}


def repo_label(root: Path) -> str:
    if root == PY_ROOT:
        return "py"
    if root == RS_ROOT:
        return "rs"
    return str(root)


def sync_fixtures(dry_run: bool = False, check: bool = False) -> bool:
    copied = 0
    skipped = 0
    out_of_sync = 0
    missing_src = 0

    for ts_rel, destinations in sorted(FIXTURE_MAP.items()):
        src = TS_ROOT / ts_rel
        if not src.exists():
            print(f"  MISSING src: {ts_rel}")
            missing_src += 1
            continue

        for repo_root, dest_rel in destinations:
            dest = repo_root / dest_rel
            label = repo_label(repo_root)

            if dest.exists() and filecmp.cmp(src, dest, shallow=False):
                skipped += 1
                continue

            action = "DIFFERS" if dest.exists() else "NEW"
            out_of_sync += 1

            if check:
                print(f"  {action} [{label}] {dest_rel}")
            elif dry_run:
                print(f"  would copy [{label}] {dest_rel}")
            else:
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dest)
                print(f"  copied [{label}] {dest_rel}")
                copied += 1

    print()
    if check:
        total = skipped + out_of_sync
        if out_of_sync:
            print(f"{out_of_sync}/{total} fixtures out of sync")
        else:
            print(f"All {total} fixtures in sync")
    elif dry_run:
        print(f"{out_of_sync} would be copied, {skipped} already in sync")
    else:
        print(f"{copied} copied, {skipped} already in sync")

    if missing_src:
        print(f"{missing_src} source fixtures missing (run yarn generate-fixtures)")

    if check:
        return out_of_sync == 0 and missing_src == 0
    return missing_src == 0


def main():
    parser = argparse.ArgumentParser(description="Sync fixtures from TypeScript to Python/Rust")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be copied")
    parser.add_argument("--check", action="store_true", help="Check sync status, exit 1 if out of sync")
    args = parser.parse_args()

    ok = sync_fixtures(dry_run=args.dry_run, check=args.check)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()

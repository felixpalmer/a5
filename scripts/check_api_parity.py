#!/usr/bin/env python3
"""Check that the TypeScript, Python and Rust ports expose the same public API.

A5 uses Polyglot Mirroring: the three implementations must present an identical
public surface. This script parses each port's public-API entrypoint, normalises
names across naming conventions (camelCase / snake_case / SCREAMING_CASE), and
reports any symbol that is not exported by all three.

Entrypoints:
    TypeScript  a5      modules/index.ts        (export { ... } from ...)
    Python      a5-py   a5/__init__.py          (__all__ = [ ... ])
    Rust        a5-rs   src/lib.rs              (pub use path::{ ... };)

Sources: by default each entrypoint is read from a sibling checkout
(`../a5-py`, `../a5-rs`). With `--remote` they are fetched from GitHub raw instead,
so CI in a single repo can check parity against the other two published repos
without checking them out. `--local PORT` forces one port back to its local file
(e.g. `--remote --local TS` checks the local TS working tree against published PY/RS).

Usage:
    python3 scripts/check_api_parity.py                      # all local
    python3 scripts/check_api_parity.py --check              # exit 1 on divergence
    python3 scripts/check_api_parity.py --remote             # all from GitHub (main)
    python3 scripts/check_api_parity.py --remote --ref v0.9.0
    python3 scripts/check_api_parity.py --remote --local TS  # local TS vs published PY/RS
    python3 scripts/check_api_parity.py --remote --branch my-feature   # prefer same-named
        # branch on each repo (fall back to main) — validates a coordinated change pre-merge
"""

import argparse
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

# Resolve the local TS repo root relative to this script (mirrors sync_fixtures.py)
SCRIPT_DIR = Path(__file__).resolve().parent
TS_ROOT = SCRIPT_DIR.parent

GITHUB_ORG = "felixpalmer"
RAW_URL = "https://raw.githubusercontent.com/{org}/{repo}/{ref}/{path}"


def parse_typescript(text):
    text = strip_line_comments(text)
    names = set()
    # export { a, b } from '...'   and   export type { X } from '...'
    for body in re.findall(r"export\s+(?:type\s+)?\{([^}]*)\}", text):
        names.update(_names_from_braces(body))
    return names


def parse_python(text):
    m = re.search(r"__all__\s*=\s*\[(.*?)\]", text, flags=re.DOTALL)
    if not m:
        raise SystemExit("could not find __all__ in a5/__init__.py")
    return set(re.findall(r"['\"]([A-Za-z_][A-Za-z0-9_]*)['\"]", m.group(1)))


def parse_rust(text):
    text = strip_line_comments(text)
    names = set()
    # pub use path::{ a, b, c };   (may span multiple lines)
    for body in re.findall(r"pub\s+use\s+[\w:]+::\{([^}]*)\}", text, flags=re.DOTALL):
        names.update(_names_from_braces(body))
    # pub use path::Name;   (single item, no braces)
    for name in re.findall(r"pub\s+use\s+[\w:]+::([A-Za-z_][A-Za-z0-9_]*)\s*;", text):
        names.add(name)
    return names


# Per-port configuration: where to read the public entrypoint from, and how to parse it.
# `repo`/`path` build the GitHub raw URL; `local` is the sibling-checkout path.
PORTS = {
    "TS": {"repo": "a5", "path": "modules/index.ts", "local": TS_ROOT / "modules" / "index.ts", "parser": parse_typescript},
    "PY": {"repo": "a5-py", "path": "a5/__init__.py", "local": TS_ROOT.parent / "a5-py" / "a5" / "__init__.py", "parser": parse_python},
    "RS": {"repo": "a5-rs", "path": "src/lib.rs", "local": TS_ROOT.parent / "a5-rs" / "src" / "lib.rs", "parser": parse_rust},
}

# Symbols deliberately allowed to differ, keyed by canonical name -> reason.
# Use sparingly; every entry is a documented, intentional divergence.
ALLOWLIST = {
    # Rust exposes the LonLat struct because it appears in public function
    # signatures (lonlat_to_cell, polygon_to_cells); TS uses a branded
    # [number, number] and Python a plain tuple, so neither exports a type.
    "lonlat": "Rust-only public type; TS/Python use structural lon/lat pairs",
}


def canonical(name):
    """Normalise an exported identifier to a convention-independent key.

    Lowercases and strips separators so that naming-convention and
    word-segmentation differences collapse to the same key:
        cellToBoundary == cell_to_boundary  -> celltoboundary
        lonLatToCell   == lonlat_to_cell    -> lonlattocell   (LonLat vs lonlat)
        u64ToHex       == u64_to_hex         -> u64tohex
        WORLD_CELL                           -> worldcell
    """
    return re.sub(r"[^a-z0-9]", "", name.lower())


def strip_line_comments(text):
    """Drop // line comments and /* */ block comments (TS/Rust)."""
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
    text = re.sub(r"//[^\n]*", "", text)
    return text


def _names_from_braces(body):
    """Split a `{a, b as c, d}` export body into the exported names."""
    names = []
    for part in body.split(","):
        part = part.strip()
        if not part:
            continue
        # `foo as bar` exports `bar`; `type Foo` exports `Foo`
        part = part.split(" as ")[-1].strip()
        part = re.sub(r"^type\s+", "", part).strip()
        if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", part):
            names.append(part)
    return names


def load_source(label, cfg, use_remote, refs):
    """Return (text, origin) for one port, from GitHub raw or the local checkout.

    For remote sources, `refs` is an ordered list of candidate git refs: the first
    one that exists on the repo is used. This lets a coordinated breaking change be
    validated against a same-named branch on each sibling repo before it lands on
    `main` — the branch is tried first, then the default ref is the fallback.
    """
    if use_remote:
        for ref in refs:
            url = RAW_URL.format(org=GITHUB_ORG, repo=cfg["repo"], ref=ref, path=cfg["path"])
            try:
                with urllib.request.urlopen(url, timeout=30) as resp:
                    return resp.read().decode("utf-8"), url
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    continue  # ref (or file on that ref) doesn't exist; try the next
                raise SystemExit(f"{label}: failed to fetch {url}: {e}")
            except OSError as e:
                raise SystemExit(f"{label}: failed to fetch {url}: {e}")
        raise SystemExit(f"{label}: {cfg['path']} not found on any of refs {refs} in {cfg['repo']}")
    path = cfg["local"]
    if not path.exists():
        raise SystemExit(f"{label}: local entrypoint not found: {path}\n"
                         f"  (check out ../{cfg['repo']} or use --remote)")
    return path.read_text(), str(path)


def build_index(names):
    """Map canonical key -> original name for one port."""
    return {canonical(name): name for name in names}


def main():
    parser = argparse.ArgumentParser(description="Check public API parity across ports")
    parser.add_argument("--check", action="store_true", help="exit 1 if any symbol diverges")
    parser.add_argument("--remote", action="store_true",
                        help="fetch entrypoints from GitHub raw instead of sibling checkouts")
    parser.add_argument("--ref", default="main",
                        help="fallback git ref to fetch in --remote mode (default: main)")
    parser.add_argument("--branch", default="",
                        help="branch to prefer on each repo if it exists, else fall back to --ref "
                             "(e.g. the PR branch, so a coordinated change validates pre-merge)")
    parser.add_argument("--local", action="append", default=[], metavar="PORT",
                        choices=list(PORTS), help="force a port (TS/PY/RS) to read locally even with --remote")
    args = parser.parse_args()

    # Try the branch first (if given), then the default ref; drop blanks/dupes, keep order.
    refs = list(dict.fromkeys(r for r in [args.branch, args.ref] if r))

    ports = []
    print("Sources:")
    for label, cfg in PORTS.items():
        use_remote = args.remote and label not in args.local
        text, origin = load_source(label, cfg, use_remote, refs)
        print(f"  {label}: {origin}")
        ports.append((label, build_index(cfg["parser"](text))))
    print()

    all_keys = set()
    for _, index in ports:
        all_keys.update(index)

    rows = []
    diverging = []
    for key in sorted(all_keys):
        present = [label for label, index in ports if key in index]
        # Use whichever port has it for the display name
        display = next(index[key] for _, index in ports if key in index)
        in_all = len(present) == len(ports)
        if not in_all and key not in ALLOWLIST:
            diverging.append((key, display, present))
        rows.append((display, [("OK" if key in index else "--") for _, index in ports], in_all or key in ALLOWLIST))

    width = max((len(d) for d, _, _ in rows), default=10)
    header = f"{'symbol':<{width}}  " + "  ".join(label for label, _ in ports)
    print(header)
    print("-" * len(header))
    for display, marks, ok in rows:
        flag = "" if ok else "   <-- diverges"
        print(f"{display:<{width}}  " + "  ".join(f"{m:<2}" for m in marks) + flag)

    print()
    if diverging:
        print(f"{len(diverging)} symbol(s) not exported by all three ports:")
        for key, display, present in diverging:
            missing = [label for label, _ in ports if label not in present]
            print(f"  - {display}: present in {', '.join(present)}; missing from {', '.join(missing)}")
        if args.check:
            return 1
    else:
        print("All public symbols are exported by all three ports.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

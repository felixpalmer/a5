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
    python3 scripts/check_api_parity.py --remote --community  # also report community ports

Community ports (`--community`): high-quality third-party bindings (R, DuckDB) are
always fetched from GitHub at their own ref and checked for coverage of the core
API — every function/constant exported by all three core ports. They may add extra
language-specific helpers, and they are not expected to export types. Gaps are
reported as warnings and never fail `--check`, since those repos are not ours.
"""

import argparse
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

# Resolve the local TS repo root relative to this script (mirrors sync_fixtures.py)
SCRIPT_DIR = Path(__file__).resolve().parent
TS_ROOT = SCRIPT_DIR.parent

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


def parse_r(text):
    # NAMESPACE: export(a5_cell_to_parent)
    return set(re.findall(r"^export\(([A-Za-z_.][A-Za-z0-9_.]*)\)", text, flags=re.MULTILINE))


def parse_duckdb(text):
    text = strip_line_comments(text)
    # ScalarFunction("a5_x", ...), ScalarFunctionSet func_set("a5_x"), TableFunction(...), ...
    return set(re.findall(r"(?:Scalar|Table|Aggregate)Function(?:Set)?\s*\w*\s*\(\s*\"(\w+)\"", text))


# Per-port configuration: where to read the public entrypoint from, and how to parse it.
# `repo`/`path` build the GitHub raw URL; `local` is the sibling-checkout path.
PORTS = {
    "TS": {"org": "felixpalmer", "repo": "a5", "path": "modules/index.ts", "local": TS_ROOT / "modules" / "index.ts", "parser": parse_typescript},
    "PY": {"org": "felixpalmer", "repo": "a5-py", "path": "a5/__init__.py", "local": TS_ROOT.parent / "a5-py" / "a5" / "__init__.py", "parser": parse_python},
    "RS": {"org": "felixpalmer", "repo": "a5-rs", "path": "src/lib.rs", "local": TS_ROOT.parent / "a5-rs" / "src" / "lib.rs", "parser": parse_rust},
}

# Community ports (--community): always remote, at their own `ref`. `prefix` is stripped
# before canonicalising (a5_cell_to_parent -> celltoparent); `aliases` maps one of the
# port's names onto the core names it covers.
COMMUNITY_PORTS = {
    "R": {"org": "belian-earth", "repo": "a5R", "ref": "main", "path": "NAMESPACE",
          "parser": parse_r, "prefix": "a5_", "aliases": {}},
    "DuckDB": {"org": "Query-farm", "repo": "a5", "ref": "main", "path": "src/a5_extension.cpp",
               "parser": parse_duckdb, "prefix": "a5_",
               # One SQL function handles any geometry type
               "aliases": {"geometrytocells": ["polygontocells", "linestringtocells"]}},
}

# Symbols deliberately allowed to differ, keyed by canonical name -> reason.
# Use sparingly; every entry is a documented, intentional divergence.
ALLOWLIST = {}


def is_rust_only_type(name, present):
    """True for a PascalCase type exported only by Rust.

    Rust must export every struct/enum that appears in a public signature
    (LonLat, PolygonToCellsOptions, Containment, ...), whereas TS passes
    structural tuples / object literals / string unions and Python passes
    tuples / keyword arguments, so neither needs a named export. Such types
    are not part of the cross-port API surface and are not flagged.
    """
    return present == ["RS"] and is_type(name)


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
            url = RAW_URL.format(org=cfg["org"], repo=cfg["repo"], ref=ref, path=cfg["path"])
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


def build_index(names, prefix="", aliases=None):
    """Map canonical key -> original name for one port."""
    index = {}
    for name in names:
        key = canonical(name[len(prefix):] if prefix and name.startswith(prefix) else name)
        index[key] = name
        for alias in (aliases or {}).get(key, []):
            index.setdefault(alias, name)
    return index


def is_type(name):
    """PascalCase names are types (LonLat, A5Cell); camelCase/snake_case/SCREAMING_CASE are not."""
    return re.fullmatch(r"[A-Z][A-Za-z0-9]*[a-z][A-Za-z0-9]*", name) is not None


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
    parser.add_argument("--community", action="store_true",
                        help="also report coverage of the core API by community ports (R, DuckDB); never fails --check")
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
    community = []
    if args.community:
        for label, cfg in COMMUNITY_PORTS.items():
            text, origin = load_source(label, cfg, True, [cfg["ref"]])
            print(f"  {label}: {origin}")
            community.append((label, build_index(cfg["parser"](text), cfg["prefix"], cfg["aliases"])))
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
        allowed = key in ALLOWLIST or is_rust_only_type(display, present)
        if not in_all and not allowed:
            diverging.append((key, display, present))
        note = "" if in_all else "   (allowed)" if allowed else "   <-- diverges"
        # Community ports only need the core functions/constants, not types
        community_marks = [("OK" if key in index else "--" if in_all and not is_type(display) else "")
                           for _, index in community]
        rows.append((display, [("OK" if key in index else "--") for _, index in ports] + community_marks, note))

    labels = [label for label, _ in ports + community]
    width = max((len(d) for d, _, _ in rows), default=10)
    header = f"{'symbol':<{width}}  " + "  ".join(labels)
    print(header)
    print("-" * len(header))
    for display, marks, note in rows:
        print(f"{display:<{width}}  " + ("  ".join(f"{m:<{len(l)}}" for m, l in zip(marks, labels)) + note).rstrip())

    if community:
        print()
        in_ci = bool(os.environ.get("GITHUB_ACTIONS"))
        for label, index in community:
            gaps = [display for display, marks, _ in rows if marks[labels.index(label)] == "--"]
            extras = sorted(index[k] for k in index if k not in all_keys)
            if gaps:
                msg = f"{label} is missing {len(gaps)} core symbol(s): {', '.join(gaps)}"
                print(f"::warning::{msg}" if in_ci else f"warning: {msg}")
            else:
                print(f"{label} covers the full core API.")
            if extras:
                print(f"  {label} extras (not checked): {', '.join(extras)}")

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

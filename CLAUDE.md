# A5 - Global Pentagonal Geospatial Index

## Overview
A5 is a TypeScript library that partitions the world into equal-area pentagonal cells at 31 resolution levels. Built on a dodecahedral geometry, it provides millimeter-accurate geospatial indexing (30mm² at highest resolution) encoded as 64-bit integers.

Website: https://a5geo.org
Docs: docs/api-reference/README.md

## Ports

- A5 is ported to Python and Rust, with each language being treated as an equally valid port.
- The Typescript project contains the docs and website
- The projects are typically checked out in parallel and can be accessed via:
  - `../a5` TypeScript version
  - `../a5-py` Python version
  - `../a5-rs` Rust version
- Each of the ports has its own `CLAUDE.md` file. Whenever you work with another project, read this file to get the additional context.


## Typescript Project Structure
- `/modules` - TypeScript source code (NOT `/src`)
  - `/core` - Core geospatial functionality (cell, hex, hilbert, serialization, etc.)
  - `/geometry` - Geometric calculations (pentagon, spherical_triangle, spherical_polygon)
  - `/projections` - Map projection implementations (dodecahedron, authalic, gnomonic, etc.)
- `/dist` - Built outputs (a5.js, a5.cjs, a5.d.ts)
- `/tests` - Vitest test files
- `/examples/cli` - CLI applications demonstrating A5 usage
- `/examples/website` - Website example applications (source code)
- `/website` - Docusaurus documentation site
  - `/website/static/data` - Static data files for website examples (JSON, Parquet, etc.)
  - `/website/src/examples` - Example page definitions that import from `/examples/website`
- `/scripts` - Build and utility scripts

## Key Concepts
- **Cell**: A pentagonal region at a specific resolution (represented as bigint)
- **Resolution**: 0-30, where 0 is global coverage and 30 is ~30mm²
- **Compaction**: Combining child cells into parent cells for efficient storage
- **Cell ID**: Always a bigint (use `u64ToHex()` for string representation)

## Commands
```bash
yarn build             # Build library
yarn generate-fixtures # Generate fixtures
yarn test              # Run tests (with watch mode)
yarn test --run        # Run tests once
yarn test hex          # Run tests just for a given file, here `hex.text.ts`
yarn bench             # Run performance benchmarks in /benchmarks (~45s, no output assertions)
yarn bench hilbert     # Run benchmarks for a single file, here `hilbert.bench.ts`
```

## Development Guidelines
- Read CONTRIBUTING.md
- **Reading files**: Use the Read tool to read source files — do NOT use `sed -n 'X,Yp' file`, `head`, or `tail` to read slices. Just read the whole file with Read.
- **TypeScript**: Source files in `/modules`, compiled to `/dist`
- **Tests**: Use Vitest, run specific tests with `yarn test <filename> --run`
- **Imports**: Run `python3 analyze_imports.py modules --check-only` after changing imports
- **Cell IDs**: Always use bigint internally, convert to hex with `u64ToHex()` / `hexToU64()`
- **Branded Types**: LonLat and other coordinate types are branded - cast with `as LonLat`, not type construction
- **Build**: Run `yarn build` before testing example CLIs
- **Documentation**: When adding new documentation pages, update `docs/table-of-contents.json` to add them to the sidebar navigation
- **Hot loops**: Prefer indexed `for` loops over `.map()` / `.forEach()` / `.filter()` in performance-sensitive paths (cell-fill, line tracing, dense-sample loops, fixture generators). Two reasons: (1) the closure form is measurably slower in V8 for large inputs (10–15% on country-scale polygons in the polygonToCells PR), and (2) `for (let i = 0; i < n; i++)` ports 1:1 to `for i in range(n)` / `for i in 0..n`, while `.map(fn)` does not.

## Website Examples
- Website example data files go in `/website/static/data/` (NOT in `/examples/website/*/public/data/`)
- `/website/static/data/` is covered by a broad `data/` gitignore rule — `git add -f` new data files or they will be invisible in `git status`
- When regenerating data for examples, compare with deployed version at https://a5geo.org/examples/* to verify resolution
- Use `getResolution()` to check the resolution of cells in existing data files
- Example resolution levels:
  - Road safety example: resolution 13 (~50k cells for UK dataset)
  - DuckDB Playground example (formerly World Population): resolution 9 base data (~700k population cells, ~1.1M elevation/temperature cells globally), re-aggregated live with `a5_cell_to_parent`
- New npm packages installed into `website/` do NOT resolve until the user restarts the dev server (webpack caches node_modules). For browser-only libraries used by one example (e.g. DuckDB WASM), prefer a runtime CDN import: `await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/...')`
- Adding/deleting example `.mdx` pages may not be picked up by a long-running dev server (stale watcher). If the "Compiled with problems" overlay references deleted files, hand-edit the generated `.docusaurus` artifacts (`registry.js`, `routes.js`, `routesChunkNames.json`, `globalData.json`, `docusaurus-plugin-content-docs/*/p/*.json`) — a server restart regenerates them from source, so these edits are safe and temporary

## Using Chrome DevTools MCP for Testing

The website development server is ALWAYS running on `localhost:3000`. Use Chrome DevTools MCP to test changes:

**Screenshot Management:**
- Name all screenshots with prefix `claude-screenshot-` followed by a descriptive suffix
- Save screenshots to `website/` directory (relative to project root)
- Clean up old `claude-screenshot-*.png` files from previous tasks before creating new ones
- Keep only screenshots relevant to the current task for debugging

**Testing guidelines:**
- NEVER attempt to start the dev server with `yarn start` or similar commands
- Assume the user has the website running at `localhost:3000`
- Reload the page after making changes to see updates
- Take snapshots for DOM inspection when needed
- Use screenshots primarily for visual verification and debugging
- Clean up screenshots when done with a task

## Polyglot Mirroring
A5 uses **Polyglot Mirroring** - maintaining functionally equivalent implementations across TypeScript, Python, and Rust. See [docs/ecosystem/polyglot-mirroring.md](docs/ecosystem/polyglot-mirroring.md) for details.

When porting features between languages:
1. **Any language can be the source** - changes can originate in TypeScript, Python, or Rust
2. **TypeScript has fixture generation** - test fixtures are generated here by default, but any implementation can be used as reference
3. **Mirror to other languages** - port the feature to the other two implementations
4. **Verify all tests pass** - all three implementations must have identical behavior
5. **Key file mappings** across languages:
   - Core implementation: `modules/core/cell.ts` ↔ `a5/core/cell.py` ↔ `src/core/cell.rs`
   - Tests: `tests/cell.test.ts` ↔ `tests/core/test_cell.py` ↔ `tests/cell.rs`
   - Exports: `modules/index.ts` ↔ `a5/__init__.py` ↔ `src/lib.rs`

## CI Checks (run as a final verification)
```bash
# 1. Check for circular dependencies
python3 analyze_imports.py modules

# 2. Build the library
yarn build

# 3. Run tests
yarn test
```

These are the same checks that run in CI (.github/workflows/test.yml). Run these to verify your changes before the user reviews the code.

On pull requests, CI also benchmarks the PR against its merge-base with main on the same runner (.github/workflows/bench.yml) and fails on a >15% regression. The comparison keys off each benchmark's **minimum** sample time, not its mean — the min is the least GC/scheduler-perturbed sample and is far more stable run-to-run (means of GC-heavy benches like gridDisk swing 15-40% between identical runs while their minimums agree within a few percent). The PR's `/benchmarks` files drive both runs (only `/modules` is switched to the baseline commit), so benchmarks must be able to run against both versions of the library code. Reproduce locally with `BENCH_OUTPUT_FILE=<file> yarn bench` on each version, then `node scripts/compare-benchmarks.cjs <baseline.json> <current.json> 15`.

## Debugging
- **DO NOT** use `node -e "..."` for debugging scripts — write them as files instead
- Write debug scripts to `/debug-scripts/` (gitignored) using the Write tool
- **Run them via `bash debug.sh` — invoked EXACTLY as `bash debug.sh`, with NO arguments and NO pipes** (no `| sed`, `| tail`, `| head`, `| grep`). It is a single gitignored entry point at the repo root that invokes `npx tsx debug-scripts/<file>.ts`, so scripts can import straight from `modules/` and `dist/`. If you need to filter/limit output, put the `sed`/`tail`/`grep` (or a smaller print) INSIDE `debug.sh` or the debug script itself — never in the Bash invocation. Piping `bash debug.sh` into anything forces a fresh permission prompt; always run the bare command.
- This avoids permission prompts and keeps scripts inspectable

## Git Usage

- **DO** use git commands for debugging and information gathering:
  - `git status` - Check current state
  - `git diff` - Compare changes
  - `git log` - View commit history
  - `git diff main` - Compare to main branch
  - `git show <commit>` - View specific commits
- **DO NOT** create git commits - the user will review the code and commit it themselves

## Testing strategy

- Tests are written such that they can easily be ported to other languages
- Tests should be driven by fixtures, JSON files that specify known input & output values
- When adding new tests:
  - 1. create the fixture generators in `/scripts/fixtures/`
  - 2. generate the fixtures using `yarn generate-fixtures` (NOT by running scripts directly)
  - 3. add the tests
  - 4. run tests and iterate, fixing either the tests, code or fixtures
- **IMPORTANT**: Always use `yarn generate-fixtures` to regenerate fixtures after code changes. This builds the library first, then runs all fixture generation scripts.
- **IMPORTANT**: If you modify `modules/test-index.ts` (which exports functions for testing), you MUST run `yarn build` before running any scripts that depend on it (like `scripts/analyze-subflavours.cjs`)
- **IMPORTANT**: Python/Rust ports should just copy across the fixtures, not have their own generators, use `yarn sync-fixtures`
- **IMPORTANT**: When adding a new shared fixture, register it in `FIXTURE_MAP` in `scripts/sync_fixtures.py` — fixtures not listed there are silently never synced to the ports
- **IMPORTANT**: The ports should verify that the behavior is exactly the same, it is NOT acceptable to round values or accept approximate equality. Precisely: integer outputs (cell IDs, resolutions, counts) must match bit-for-bit; floating-point outputs are compared at the tolerance the tests define (typically 1e-10) — cross-language ulp-identity is not achievable and not required

## Important
- Keep changes minimal and focused on requested tasks
- Don't create unnecessary .d.ts files
- Verify no circular dependencies when modifying imports
- Build outputs in `/dist` are auto-generated (don't edit directly)
- If instructions in `CLAUDE.md` seem wrong, update them and notify the user

## Self-Improvement
After completing a porting task (implementing features across TypeScript/Python/Rust):
1. **Review the session** - Identify any confusion, file hunting, or unclear instructions
2. **Consider updates** - Would adding context to CLAUDE.md files have helped?
3. **Keep it concise** - Only add guidance if it would clearly prevent future issues
4. **Update all three** - If guidance applies across ports, update all CLAUDE.md files
5. **Note to user** - Mention the improvements made

Examples of valuable additions: file location clarifications, type system gotchas, common porting patterns
Examples of noise: obvious information, language basics, one-off issues that won't recur

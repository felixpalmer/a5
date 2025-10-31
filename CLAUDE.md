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
- `/website` - Docusaurus documentation site
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
```

## Development Guidelines
- **TypeScript**: Source files in `/modules`, compiled to `/dist`
- **Tests**: Use Vitest, run specific tests with `yarn test <filename> --run`
- **Imports**: Run `python3 analyze_imports.py modules --check-only` after changing imports
- **Cell IDs**: Always use bigint internally, convert to hex with `u64ToHex()` / `hexToBigInt()`
- **Branded Types**: LonLat and other coordinate types are branded - cast with `as LonLat`, not type construction
- **Build**: Run `yarn build` before testing example CLIs

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
  - 1. create the fixture generators
  - 2. generate the fixtures
  - 3. add the tests
  - 4. run tests and iterate, fixing either the tests, code or fixtures
- Python/Rust ports should just copy across the fixtures, not have their own generators
- IMPORTANT: The ports should verify that the behavior is exactly the same, it is NOT acceptable to round values or accept approximate equality

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

# Change Log

All notable changes to A5 will be documented in this file.

For the latest documentation, visit [A5 Documentation](https://a5geo.org)

<!--
Each version should:
  List its release date in the above format.
  Group changes to describe their impact on the project, as follows:
  Added for new features.
  Changed for changes in existing functionality.
  Deprecated for once-stable features removed in upcoming releases.
  Removed for deprecated features removed in this release.
  Fixed for any bug fixes.
  Security to invite users to upgrade in case of vulnerabilities.
Ref: http://keepachangelog.com/en/0.3.0/
-->

## A5

#### A5 [v0.7.2] - Mar 29 2026

- Feature: Support neighbor functions in res 0 & 1 (#87)

#### A5 [v0.7.1] - Mar 11 2026

- Feature: Support (de)serialization of resolution 30 cells (#82)

#### A5 [v0.7.0] - Mar 3 2026

- Feature: gridDisk & sphericalCap (#78)

#### A5 [v0.6.1] - Nov 11 2025

- feat: World cell handling (#66)

#### A5 [v0.6.0] - Oct 30 2025

- Feature: cell compaction/uncompaction (#64) 

#### A5 [v0.5.0] - Sep 21 2025

- **BREAKING**: Renamed hex conversion functions to use u64 naming convention
  - `hexToBigInt` → `hexToU64`
  - `bigIntToHex` → `u64ToHex`

## A5 v0.4

#### A5 [v0.4.2] - Aug 7 2025

- Fixed: cellToChildren and cellToParent functions (#52)
- Added: JavaScript and Python quickstarts to website (#51)

#### A5 [v0.4.1] - Jul 30 2025

- Fixed: Containment check in lattice app (#50)
- Added: Tiling tests (#49)
- Changed: Tidy geometry pentagon (#48)
- Fixed: a5cellContainsPoint check in projected space (#47)
- Changed: Improve accuracy of origin.quat definitions (#46)

#### A5 [v0.4.0] - Jul 15 2025

- Changed: Tidy geometry classes and tests (#45)
- Changed: calculate_error_budgets: stochastic sampling (#44)
- Added: getRes0Cells, cellArea & getNumCells functions (#43)

## A5 v0.3

#### A5 [v0.3.0] - Jul 13 2025

- Changed: Refactor of projection tests & test data (#42)
- Changed: Update heatmap data (#41)
- Added: Static CRS to improve projection accuracy (#40)
- Added: Integration fixtures (#39)
- Changed: Area calculation cleanup (#38)
- Added: True equal area polyhedral projection (#37)
- Changed: Website tweaks (#34)
- Added: Missing tests & general integration test (#33)
- Changed: Update heatmap data with authalic projection (#32)

## A5 v0.2

#### A5 [v0.2.0] - Jun 10 2025

- Added: Use authalic latitude (#31)
- Changed: Low/high warp parameters (#30)
- Added: Curved edge segments & GeoJSON output format (#29)
- Changed: Tweak warp parameters (#28)
- Changed: Update traffic data (#27)
- Added: SphericalPentagonShape & test app (#26)
- Changed: Better point in pentagon test (#25)
- Added: Test fixed places (#24)
- Changed: Update cell.test.ts (#23)
- Changed: Update curve such that child cells overlap parent (#22)
- Added: Authalic conversion functions (#21)
- Added: Dependency analysis (#20)
- Changed: Rename coordinate systems files (#19)
- Changed: Update warp tests (#18)
- Added: CI workflow to check that website will build (#17)
- Added: Setup PR template and CI testing (#16)
- Changed: Cleanup imports to avoid circular dependencies

## A5 v0.1

#### A5 [v0.1.3] - May 16 2025

- Fixed: Remove browser from package.json

#### A5 [v0.1.2] - May 16 2025

- Fixed: Package compatibility issues

#### A5 [v0.1.1] - May 16 2025

- Fixed: Better package compatibility

#### A5 [v0.1.0] - May 16 2025

- Added: Initial release of A5 - Global Pentagonal Geospatial Index
- Added: Core indexing functions (lonLatToCell, cellToLonLat, cellToBoundary)
- Added: Hierarchy functions (cellToParent, cellToChildren, getResolution)
- Added: Hex conversion utilities
- Added: Complete projection system with authalic, gnomonic, and polyhedral projections
- Added: Geometry utilities for pentagon and spherical polygon operations
- Added: Comprehensive test suite
- Added: TypeScript support with full type definitions
- Added: Multiple output formats (ESM, CJS, UMD)

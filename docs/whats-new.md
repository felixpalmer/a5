---
description: "What's new in A5 v1: permanent cell IDs, coverings and set operations, spatial hierarchy functions and faster traversal and polygon filling."
---

import Teohedron from '/images/whatsnew-teohedron.gif';
import Coverings from '/images/whatsnew-coverings.gif';
import Subcells from '/images/whatsnew-subcells.gif';
import Perf from '/images/whatsnew-perf.gif';

# What's New

## v1.0

v1 is the first stable release of A5. If you are upgrading from `0.x`, see the [Upgrade Guide](./upgrade-guide).

### Cell IDs

<img src={Teohedron} style={{width: "100%", maxWidth: "600px"}}/>

- **New teohedral space-filling curve** which [does not self-intersect](../examples/teohedral-curve), greatly improving performance
- As a consequence, while cell geometry is unchanged, **cell IDs** change. Cell IDs and are now frozen and will not change in future versions
- Resolution 1 cells are now also pentagons, so the system has a single **cell topology** throughout

### Coverings

<img src={Coverings} style={{width: "100%", maxWidth: "600px"}}/>

- [Coverings](./api-reference/coverings): compacted sets of cells that record their resolution with a [compaction marker](./api-reference/compaction#coverings-and-the-compaction-marker), providing an efficient way to represent regions of cells
- Coverings have a suite of new operators which work with the compacted data directly, unlocking previously impossible workflows:
  - Set operations: [`union`](./api-reference/coverings#union), [`intersect`](./api-reference/coverings#intersect) and [`difference`](./api-reference/coverings#difference)
  - Predicates: [`contains`](./api-reference/coverings#contains) and [`overlaps`](./api-reference/coverings#overlaps)
  - Measures: [`count`](./api-reference/coverings#count) and [`area`](./api-reference/coverings#area)

*See [Coverings example](../examples/coverings) for demo*

### Spatial hierarchy functions

<img src={Subcells} style={{width: "100%", maxWidth: "600px"}}/>

- [`cellToSubcells`](./api-reference/hierarchy#celltosubcells) returns the finer resolution cells that cover (by centroid) a given cell
- [`cellToSupercell`](./api-reference/hierarchy#celltosupercell) is the inverse relation

*See [Hierarchy example](../examples/hierarchy) for demo*

### Performance

Large performance gains across all APIs, in part thanks to the new **teohedral curve**, in part due to many targeted optimizations. Selected benchmarks are shown below; note in particular the performance of `polygonToCells` for high resolutions.

| API | Benchmark | v0.10 | v1.0 | Speedup |
|---|---|--:|--:|--:|
| `polygonToCells` | Brazil res 6 | 2.66 ms | 1.55 ms | 1.72× |
| `polygonToCells` | Brazil res 8 | 14.29 ms | 4.86 ms | 2.94× |
| `polygonToCells` | Brazil res 10 | 131.26 ms | 15.00 ms | 8.75× |
| `polygonToCells` | Brazil res 12 | 1.96 s | 49.84 ms | **39.40×** |
| `lineStringToCells` | London–Paris res 9 | 590.70 µs | 47.00 µs | **12.57×** |
| `lineStringToCells` | round-the-world res 6 | 5.11 ms | 472.90 µs | **10.81×** |
| `compact` | UK res 10 | 320.32 µs | 29.37 µs | **10.91×** |
| `gridDisk` | k=1 | 1.55 µs | 1.16 µs | 1.34× |
| `gridDisk` | k=5 | 71.22 µs | 19.83 µs | 3.59× |
| `gridDisk` | k=20 | 1.64 ms | 397.75 µs | 4.12× |
| `gridDiskVertex` | k=5 | 143.27 µs | 35.79 µs | 4.00× |
| `sphericalCap` | res 12, 5 km | 201.07 µs | 54.09 µs | 3.72× |
| `lonLatToCell` | res 5 | 1.87 µs | 848.5 ns | 2.20× |
| `lonLatToCell` | res 15 | 2.37 µs | 966.1 ns | 2.46× |
| `lonLatToCell` | res 30 | 5.50 µs | 1.15 µs | 4.77× |
| `cellToLonLat` | res 5 | 290.8 ns | 228.2 ns | 1.27× |
| `cellToLonLat` | res 15 | 348.5 ns | 283.8 ns | 1.23× |
| `cellToLonLat` | res 30 | 524.0 ns | 337.1 ns | 1.55× |

### Website

<img src={Perf} style={{width: "100%", maxWidth: "600px"}}/>

- New landing page
- All documentation reviewed and rewritten
- Code examples now render in 5 languages (DuckDB, Python, R, JavaScript & Rust)
- Visual [examples](../examples) refreshed

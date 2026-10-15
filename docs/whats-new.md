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

<img src={Perf} style={{width: "100%", maxWidth: "600px"}}/>

Large performance gains across all APIs, in part thanks to the new **teohedral curve**, in part due to many targeted optimizations:

TODO performance table

### Website

- New landing page
- All documentation reviewed and rewritten
- Code examples now render in 5 languages (DuckDB, Python, R, JavaScript & Rust)
- Visual [examples](../examples) refreshed

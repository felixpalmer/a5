---
description: "Index of all A5 functions, with how their names differ between TypeScript, Python, Rust, DuckDB and R."
---

# Overview

A5 has the same API in every language, with the following functions available. They are listed by their TypeScript names: Python and Rust use `snake_case` (`lonlat_to_cell`), and DuckDB and R add an `a5_` prefix (`a5_lonlat_to_cell`).

AI coding agents can read these docs as Markdown, with code samples in a single language: see [llms.txt](pathname:///llms.txt).

For examples on how to use the code, see the [example code on Github](https://github.com/felixpalmer/a5/tree/main/examples)

### Indexing

- [lonLatToCell](./api-reference/indexing#lonlattocell)
- [cellToLonLat](./api-reference/indexing#celltolonlat)
- [cellToBoundary](./api-reference/indexing#celltoboundary)
- [polygonToCells](./api-reference/indexing#polygontocells)
- [lineStringToCells](./api-reference/indexing#linestringtocells)
- [u64ToHex](./api-reference/indexing#u64tohex)
- [hexToU64](./api-reference/indexing#hextou64)

### Hierarchy

- [getResolution](./api-reference/hierarchy#getresolution)
- [cellToParent](./api-reference/hierarchy#celltoparent)
- [cellToChildren](./api-reference/hierarchy#celltochildren)
- [cellToSupercell](./api-reference/hierarchy#celltosupercell)
- [cellToSubcell](./api-reference/hierarchy#celltosubcell)
- [getRes0Cells](./api-reference/hierarchy#getres0cells)

### Cell Info

- [getNumCells](./api-reference/cell-info#getnumcells)
- [cellArea](./api-reference/cell-info#cellarea)
- [cellEdgeLengthAvg](./api-reference/cell-info#celledgelengthavg)
- [isValidCell](./api-reference/cell-info#isvalidcell)

### Traversal

- [gridDisk](./api-reference/traversal#griddisk)
- [gridDiskVertex](./api-reference/traversal#griddiskvertex)
- [sphericalCap](./api-reference/traversal#sphericalcap)

### Compaction

- [compact](./api-reference/compaction#compact)
- [uncompact](./api-reference/compaction#uncompact)
- [coveringResolution](./api-reference/compaction#coveringresolution)
- [isCompactionMarker](./api-reference/compaction#iscompactionmarker)

### Coverings

- [union](./api-reference/coverings#union)
- [intersect](./api-reference/coverings#intersect)
- [difference](./api-reference/coverings#difference)
- [contains](./api-reference/coverings#contains)
- [overlaps](./api-reference/coverings#overlaps)
- [count](./api-reference/coverings#count)
- [area](./api-reference/coverings#area)

### Miscellaneous

- [migrate](./api-reference/miscellaneous#migrate)

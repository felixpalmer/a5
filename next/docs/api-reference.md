# Overview

A5 has the same API in every language, with the following functions available. They are listed by their TypeScript names: Python and Rust use `snake_case` (`lonlat_to_cell`), and DuckDB and R add an `a5_` prefix (`a5_lonlat_to_cell`).

AI coding agents can read these docs as Markdown, with code samples in a single language: see [llms.txt](https://a5geo.org/next/llms.txt).

For examples of how to use the code, see the [example code on GitHub](https://github.com/felixpalmer/a5/tree/main/examples).

### Indexing

- [lonLatToCell](https://a5geo.org/next/docs/api-reference/indexing.md#lonlattocell)
- [cellToLonLat](https://a5geo.org/next/docs/api-reference/indexing.md#celltolonlat)
- [cellToBoundary](https://a5geo.org/next/docs/api-reference/indexing.md#celltoboundary)
- [polygonToCells](https://a5geo.org/next/docs/api-reference/indexing.md#polygontocells)
- [lineStringToCells](https://a5geo.org/next/docs/api-reference/indexing.md#linestringtocells)
- [u64ToHex](https://a5geo.org/next/docs/api-reference/indexing.md#u64tohex)
- [hexToU64](https://a5geo.org/next/docs/api-reference/indexing.md#hextou64)

### Hierarchy

- [getResolution](https://a5geo.org/next/docs/api-reference/hierarchy.md#getresolution)
- [cellToParent](https://a5geo.org/next/docs/api-reference/hierarchy.md#celltoparent)
- [cellToChildren](https://a5geo.org/next/docs/api-reference/hierarchy.md#celltochildren)
- [cellToSupercell](https://a5geo.org/next/docs/api-reference/hierarchy.md#celltosupercell)
- [cellToSubcells](https://a5geo.org/next/docs/api-reference/hierarchy.md#celltosubcells)
- [getRes0Cells](https://a5geo.org/next/docs/api-reference/hierarchy.md#getres0cells)

### Cell Info

- [getNumCells](https://a5geo.org/next/docs/api-reference/cell-info.md#getnumcells)
- [cellArea](https://a5geo.org/next/docs/api-reference/cell-info.md#cellarea)
- [cellEdgeLengthAvg](https://a5geo.org/next/docs/api-reference/cell-info.md#celledgelengthavg)
- [isValidCell](https://a5geo.org/next/docs/api-reference/cell-info.md#isvalidcell)

### Traversal

- [gridDisk](https://a5geo.org/next/docs/api-reference/traversal.md#griddisk)
- [gridDiskVertex](https://a5geo.org/next/docs/api-reference/traversal.md#griddiskvertex)
- [sphericalCap](https://a5geo.org/next/docs/api-reference/traversal.md#sphericalcap)

### Compaction

- [compact](https://a5geo.org/next/docs/api-reference/compaction.md#compact)
- [uncompact](https://a5geo.org/next/docs/api-reference/compaction.md#uncompact)
- [coveringResolution](https://a5geo.org/next/docs/api-reference/compaction.md#coveringresolution)
- [isCompactionMarker](https://a5geo.org/next/docs/api-reference/compaction.md#iscompactionmarker)

### Coverings

- [union](https://a5geo.org/next/docs/api-reference/coverings.md#union)
- [intersect](https://a5geo.org/next/docs/api-reference/coverings.md#intersect)
- [difference](https://a5geo.org/next/docs/api-reference/coverings.md#difference)
- [contains](https://a5geo.org/next/docs/api-reference/coverings.md#contains)
- [overlaps](https://a5geo.org/next/docs/api-reference/coverings.md#overlaps)
- [count](https://a5geo.org/next/docs/api-reference/coverings.md#count)
- [area](https://a5geo.org/next/docs/api-reference/coverings.md#area)

### Miscellaneous

- [migrate](https://a5geo.org/next/docs/api-reference/miscellaneous.md#migrate)

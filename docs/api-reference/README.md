# Overview

The reference implementation of A5 is written in Typescript, with the following functions available.

For examples on how to use the code, see the [example code on Github](https://github.com/felixpalmer/a5/tree/main/examples)

### Indexing

- [lonLatToCell](./api-reference/indexing#lonlattocell)
- [cellToLonLat](./api-reference/indexing#celltolonlat)
- [cellToBoundary](./api-reference/indexing#celltoboundary)
- [u64ToHex](./api-reference/indexing#u64tohex)
- [hexToU64](./api-reference/indexing#hextou64)

### Hierarchy

- [getResolution](./api-reference/hierarchy#getresolution)
- [cellToParent](./api-reference/hierarchy#celltoparent)
- [cellToChildren](./api-reference/hierarchy#celltochildren)

### Traversal

- [gridDisk](./api-reference/traversal#griddisk)
- [gridDiskVertex](./api-reference/traversal#griddiskvertex)
- [sphericalCap](./api-reference/traversal#sphericalcap)
- [lineStringToCells](./api-reference/traversal#linestringtocells)

### Regions

- [polygonToCells](./api-reference/regions#polygontocells)

### Compaction

- [compact](./api-reference/compaction#compact)
- [uncompact](./api-reference/compaction#uncompact)
- [getCompactionResolution](./api-reference/compaction#getcompactionresolution)
- [isCompactionMarker](./api-reference/compaction#iscompactionmarker)

### Set Operations

- [union](./api-reference/set-operations#union)
- [intersect](./api-reference/set-operations#intersect)
- [difference](./api-reference/set-operations#difference)
- [contains](./api-reference/set-operations#contains)
- [overlaps](./api-reference/set-operations#overlaps)
- [count](./api-reference/set-operations#count)
- [area](./api-reference/set-operations#area)

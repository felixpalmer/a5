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

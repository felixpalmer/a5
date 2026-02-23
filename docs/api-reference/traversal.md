# Traversal

Functions for finding neighboring cells and collecting cells within a region.

A5 pentagons have two kinds of neighbors: **edge-sharing** neighbors (cells that share a full edge, always exactly 5) and **vertex-sharing** neighbors (cells that share only a vertex, 1-3 depending on position). Together these give each cell 6-8 total neighbors.

### gridDisk

Returns all cells within `k` edge-sharing hops of a center cell, using breadth-first search. This matches H3's `gridDisk` semantics.

At each step, only edge-sharing neighbors (5 per cell) are followed. The result is compacted — use [`uncompact`](compaction#uncompact) to expand to the target resolution.

```ts
function gridDisk(cellId: bigint, k: number): BigUint64Array;
```

#### Parameters

- `cellId` **(bigint)** Center A5 cell identifier
- `k` **(number)** Number of hops (0 returns just the center cell)

#### Return value

- **(BigUint64Array)** Sorted, compacted array of cell identifiers in the disk

#### Example

```ts
import { lonLatToCell, gridDisk, uncompact, getResolution } from 'a5-js';

const cell = lonLatToCell([2.3522, 48.8566], 10);
const ring1 = uncompact(gridDisk(cell, 1), getResolution(cell)); // center + 5 edge neighbors
const ring2 = uncompact(gridDisk(cell, 2), getResolution(cell)); // center + ring 1 + ring 2
```

### gridDiskVertex

Returns all cells within `k` hops of a center cell, following both edge-sharing and vertex-sharing neighbors. This is an A5 extension for the pentagonal tiling where vertex-only neighbors exist.

The result is compacted — use [`uncompact`](compaction#uncompact) to expand to the target resolution.

```ts
function gridDiskVertex(cellId: bigint, k: number): BigUint64Array;
```

#### Parameters

- `cellId` **(bigint)** Center A5 cell identifier
- `k` **(number)** Number of hops (0 returns just the center cell)

#### Return value

- **(BigUint64Array)** Sorted, compacted array of cell identifiers in the disk

### sphericalCap

Computes all cells whose centers fall within a great-circle radius from the center of a given cell. Returns a naturally compacted result where interior cells are kept at coarser resolutions, which is more efficient for large radii.

Use [`uncompact`](compaction#uncompact) to expand the result back to the target resolution if needed.

```ts
function sphericalCap(cellId: bigint, radius: number): BigUint64Array;
```

#### Parameters

- `cellId` **(bigint)** Center A5 cell identifier
- `radius` **(number)** Radius in meters

#### Return value

- **(BigUint64Array)** Sorted array of cell identifiers at mixed resolutions (compacted)

#### Example

```ts
import { lonLatToCell, sphericalCap, uncompact, getResolution } from 'a5-js';

const cell = lonLatToCell([2.3522, 48.8566], 10);
const compact = sphericalCap(cell, 500_000); // 500 km
const flat = uncompact(compact, getResolution(cell)); // BigUint64Array at target resolution
```

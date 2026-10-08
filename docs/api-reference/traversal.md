# Traversal

Functions for finding neighboring cells and collecting cells within a range. See the [Traversal](../../examples/traversal) example.

Each A5 cell has exactly 5 edge neighbors, which can be obtained using the `gridDisk` function. If the vertex neighbors are required, `gridDiskVertex` can be used. For broader range queries `sphericalCap` provides all the cells within a great-circle radius. To trace cells along a path, use [`lineStringToCells`](./indexing#linestringtocells).

In order to save memory, the returned cells from `gridDisk`, `gridDiskVertex` and `sphericalCap` are [compacted](./compaction) into a [covering](./coverings): the cells, then a [compaction marker](./compaction#coverings-and-the-compaction-marker) recording their resolution. Coverings can be combined with the [set operations](./coverings).

### gridDisk

Returns all cells within `k` edge-sharing hops of a center cell.

At each step, only edge-sharing neighbors (5 per cell) are followed.

The result is compacted — use [`uncompact`](compaction#uncompact) to expand it to the resolution of the center cell.

```ts
function gridDisk(cellId: bigint, k: number): BigUint64Array;
```

#### Parameters

- `cellId` **(bigint)** Center A5 cell identifier
- `k` **(number)** Number of hops (0 returns just the center cell)

#### Return value

- **(BigUint64Array)** Compacted cells in the disk sorted in curve order, then the [compaction marker](./compaction#coverings-and-the-compaction-marker)

#### Example

```ts
import { lonLatToCell, gridDisk, uncompact } from 'a5-js';

const cell = lonLatToCell([2.3522, 48.8566], 10);
const ring1 = gridDisk(cell, 1); // center + 5 edge neighbors (compacted)
const ring2 = uncompact(gridDisk(cell, 2)); // center + ring 1 + ring 2 (uncompacted)
```

### gridDiskVertex

Returns all cells within `k` hops of a center cell, following both edge-sharing and vertex-sharing neighbors.

The result is compacted — use [`uncompact`](compaction#uncompact) to expand it to the resolution of the center cell.

```ts
function gridDiskVertex(cellId: bigint, k: number): BigUint64Array;
```

#### Parameters

- `cellId` **(bigint)** Center A5 cell identifier
- `k` **(number)** Number of hops (0 returns just the center cell)

#### Return value

- **(BigUint64Array)** Compacted cells in the disk sorted in curve order, then the [compaction marker](./compaction#coverings-and-the-compaction-marker)

### sphericalCap

Computes all cells whose centers fall within a great-circle radius from the center of a given cell.

The result is compacted — use [`uncompact`](compaction#uncompact) to expand it to the resolution of the center cell.

```ts
function sphericalCap(cellId: bigint, radius: number): BigUint64Array;
```

#### Parameters

- `cellId` **(bigint)** Center A5 cell identifier
- `radius` **(number)** Radius in meters

#### Return value

- **(BigUint64Array)** Compacted cells sorted in curve order, then the [compaction marker](./compaction#coverings-and-the-compaction-marker)

#### Example

```ts
import { lonLatToCell, sphericalCap, uncompact } from 'a5-js';

const cell = lonLatToCell([2.3522, 48.8566], 10);
const compact = sphericalCap(cell, 500_000); // 500 km
const flat = uncompact(compact); // all cells at resolution 10
```

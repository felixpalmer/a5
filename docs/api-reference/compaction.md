# Compaction

Compaction is a way to efficiently represent a set of A5 cells by replacing groups of sibling cells with their parent cell. This reduces the number of cells needed to represent a region while maintaining complete coverage.

For example, if you have all 4 children of a cell, you can represent them with just their parent cell. The `compact()` function performs this optimization, and `uncompact()` reverses it by expanding parent cells back into their children.

The result of a compaction is a [covering](./coverings.md), which automatically stores the resolution of the compacted cells in-band using a [Compaction Marker](#coverings-and-the-compaction-marker)

## Functions supporting compacted data

Many of the functions in the A5 API return and accept compacted data, and should be used whenever possible rather than using the more low-level functions below. See [here](./coverings#example-processing-flow) for an example.

- Indexing: [`polygonToCells`](./indexing#polygontocells)
- Traversal: [`gridDisk`](./traversal#griddisk), [`gridDiskVertex`](./traversal#griddiskvertex), [`sphericalCap`](./traversal#sphericalcap)
- Set operations: [`union`](./coverings#union), [`intersect`](./coverings#intersect), [`difference`](./coverings#difference)
- Predicates: [`contains`](./coverings#contains), [`overlaps`](./coverings#overlaps)
- Measures: [`count`](./coverings#count), [`area`](./coverings#area)


## Compaction helpers

### compact

Compacts a set of A5 cells by replacing complete groups of sibling cells with their parent cells, and appends the compaction marker recording the resolution of the finest input cell. In most cases users will use [polygonToCells](./indexing#polygontocells)

```ts
function compact(cells: bigint[] | BigUint64Array): BigUint64Array;
```

#### Parameters

- `cells` **(bigint[] | BigUint64Array)** Array of A5 cell identifiers to compact

#### Return value

- **(BigUint64Array)** Compacted cells sorted in curve order, then the compaction marker. An empty input returns an empty array.

#### Example

```ts
import { compact, uncompact, count, coveringResolution, cellToChildren } from 'a5-js';

// Get 4 sibling cells at resolution 3
const parent = 0x6a80000000000000n;  // A cell at resolution 2
const children = cellToChildren(parent);

// Compact them: they are stored as their parent, but still stand for 4 cells at resolution 3
const compacted = compact(children);
console.log(count(compacted));  // 4n
console.log(coveringResolution(compacted));  // 3
console.log(uncompact(compacted));  // the 4 children again
```

### uncompact

Expands a covering to all of its cells at the covering's resolution: the resolution of its compaction marker, or of its finest cell when it has none.

```ts
function uncompact(cells: bigint[] | BigUint64Array): BigUint64Array;
```

#### Parameters

- `cells` **(bigint[] | BigUint64Array)** A covering, as returned by `compact` or `polygonToCells`

#### Return value

- **(BigUint64Array)** Array of cell identifiers, all at the covering's resolution

#### Example

```ts
import { polygonToCells, uncompact, getResolution } from 'a5-js';

const ring = [[2.25, 48.81], [2.42, 48.81], [2.42, 48.90], [2.25, 48.90]];
const compacted = polygonToCells(ring, 10);

// No resolution needed: the compaction marker records it
const flat = uncompact(compacted);
console.log(getResolution(flat[0]));  // 10
```

#### Notes

- All output cells are at the covering's resolution; the compaction marker is not included
- The expansion is complete - every descendant cell at that resolution is included
- **Ordering property**: If the input is sorted in curve order (as `compact` returns it), the output is too. All children of a cell form a contiguous, ordered block on the curve, so `uncompact` on a covering produces sorted output without requiring a re-sort, which is useful for large result sets
- To expand a compacted array that predates the compaction marker (and so lost its resolution), expand each cell to the known resolution instead: `cells.flatMap(c => cellToChildren(c, resolution))`

### coveringResolution

Returns the resolution a covering stands for: the resolution of its compaction marker, or of its finest cell when it has none.

```ts
function coveringResolution(cells: bigint[] | BigUint64Array): number;
```

#### Parameters

- `cells` **(bigint[] | BigUint64Array)** A covering, or any array of cells

#### Return value

- **(number)** Resolution (0–30), or -1 for an empty array or the [world cell](../technical/index-encoding#special-case-world-cell)

#### Example

```ts
import { compact, coveringResolution, cellToChildren } from 'a5-js';

const parent = 0x6a80000000000000n;  // resolution 2
const compacted = compact(cellToChildren(parent, 4));
console.log(coveringResolution(compacted));  // 4
```

### isCompactionMarker

Checks whether a value is a compaction marker, the value at the end of a covering that records its resolution. Most code never needs it: the A5 functions that read coverings handle the compaction marker themselves, and to get a covering's cells one at a time, use [`uncompact`](#uncompact). Always keep the compaction marker when you store or pass on a covering, as without it the compacted cells no longer say which resolution they stand for.

```ts
function isCompactionMarker(value: bigint): boolean;
```

#### Parameters

- `value` **(bigint)** Value from a covering

#### Return value

- **(boolean)** Whether the value is a compaction marker

#### Example

```ts
import { isCompactionMarker, lonLatToCell } from 'a5-js';

console.log(isCompactionMarker(lonLatToCell([2.35, 48.85], 10)));  // false: a cell
```

## Coverings and the compaction marker

A compacted array holds cells at mixed resolutions, but it stands for a set of cells at **one** resolution: compacting 8 cells at resolution 4 may leave 2 cells at resolution 3, which still mean those 8 cells. To keep that resolution, every compacted array ends with a **compaction marker**: a value in quintant 60 (only 0–59 exist), which no cell can take, recording the resolution of the set — for example `0xf00a000000000040` for resolution 10. We call such an array a *covering*, see [Coverings](./coverings) for the functions that combine, query and measure them.

- `uncompact` reads the compaction marker, so it needs no resolution argument.
- The array is still a plain `BigUint64Array` of 64-bit values, so a covering stores as a single list column in a database, Parquet or Arrow — the resolution travels with it.
- `cellToBoundary` returns `[]` for the compaction marker, so rendering a covering draws only its cells.
- An array without a compaction marker is a covering too: its resolution is that of its finest cell.

Read coverings only through the A5 functions, which handle the compaction marker for you, rather than indexing the array or taking its length: [`count`](./coverings#count) and [`area`](./coverings#area) measure a covering, [`contains`](./coverings#contains) tests a cell, [`uncompact`](#uncompact) lists its cells at its resolution, and [`coveringResolution`](#coveringresolution) gives that resolution.

`compact`, [`polygonToCells`](./indexing#polygontocells), [`gridDisk`](./traversal#griddisk), [`gridDiskVertex`](./traversal#griddiskvertex), [`sphericalCap`](./traversal#sphericalcap) and the [set operations](./coverings) all return coverings. The cells come sorted in curve order (the order of the A5 space-filling curve), with the compaction marker last.

See [Bit Tags](../technical/bit-tags#compaction-marker) for how the compaction marker is encoded.



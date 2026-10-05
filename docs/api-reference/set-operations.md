# Set Operations

Functions for combining and measuring [collections](./compaction#collections-and-the-compaction-marker) of cells, such as the output of `polygonToCells`, `sphericalCap` or `compact`.

All of them work directly on compacted data, without uncompacting. At its finest resolution (30) the A5 space-filling curve passes through every *leaf cell* once, so the curve can be pictured as a line of slots, one per leaf cell. A cell at resolution r occupies 4^(30−r) consecutive slots, and a collection in curve order occupies a sorted list of such stretches, so a set operation is a single merge of two sorted lists. Inputs may be compacted or not, but both must be at the same resolution: A5 cells don't nest geometrically across resolutions, so combining, say, a resolution 7 set with a resolution 9 set has no meaning, and the functions throw. Results are compacted at that resolution, with a compaction marker recording it. Every value given must be an A5 cell or a compaction marker: anything else, such as a corrupted ID, makes these functions throw rather than return a wrong answer.

```ts
import { polygonToCells, sphericalCap, lonLatToCell, intersect, area, contains } from 'a5-js';

const france = polygonToCells(franceRing, 12);
const nearParis = sphericalCap(lonLatToCell([2.3522, 48.8566], 12), 200_000);

// Part of France within 200 km of Paris, both at resolution 12 — without uncompacting either input
const region = intersect(france, nearParis);
console.log(area(region) / 1e6, 'km²');

// Point in polygon: index the point at the collection's resolution, then one binary search
console.log(contains(france, lonLatToCell([4.8357, 45.764], 12)));  // Lyon: true
```

### union

Returns the cells in either collection. Both must be at the same resolution, or it throws.

```ts
function union(a: bigint[] | BigUint64Array, b: bigint[] | BigUint64Array): BigUint64Array;
```

#### Parameters

- `a` **(bigint[] | BigUint64Array)** First collection
- `b` **(bigint[] | BigUint64Array)** Second collection

#### Return value

- **(BigUint64Array)** Compacted cells sorted in curve order, then the compaction marker recording their resolution

#### Example

```ts
import { polygonToCells, union } from 'a5-js';

// A multi-polygon: the union of its parts
const coverage = union(polygonToCells(mainland, 10), polygonToCells(island, 10));
```

### intersect

Returns the cells in both collections. Both must be at the same resolution, or it throws.

```ts
function intersect(a: bigint[] | BigUint64Array, b: bigint[] | BigUint64Array): BigUint64Array;
```

#### Parameters

- `a` **(bigint[] | BigUint64Array)** First collection
- `b` **(bigint[] | BigUint64Array)** Second collection

#### Return value

- **(BigUint64Array)** Compacted cells sorted in curve order, then the compaction marker recording their resolution

### difference

Returns the cells in the first collection but not in the second. Both must be at the same resolution, or it throws.

```ts
function difference(a: bigint[] | BigUint64Array, b: bigint[] | BigUint64Array): BigUint64Array;
```

#### Parameters

- `a` **(bigint[] | BigUint64Array)** Collection to subtract from
- `b` **(bigint[] | BigUint64Array)** Collection to subtract

#### Return value

- **(BigUint64Array)** Compacted cells sorted in curve order, then the compaction marker recording their resolution

#### Example

```ts
import { polygonToCells, difference, lonLatToCell, sphericalCap } from 'a5-js';

// A country without the area within 50 km of its capital
const outside = difference(polygonToCells(ring, 10), sphericalCap(lonLatToCell(capital, 10), 50_000));
```

### contains

Checks whether a cell is in a collection. The cell must be at the collection's resolution, or it throws: A5 cells don't nest geometrically across resolutions, so a finer cell isn't guaranteed to lie inside its ancestor. To test a point, index it at the collection's resolution with `lonLatToCell(point, resolution)`.

The test is a binary search, so the collection must be sorted in curve order, as returned by `compact`, `polygonToCells` and the other A5 functions. For speed, it checks only the cell and the collection cell the search lands on: a value elsewhere in the collection that is not a cell goes unnoticed.

```ts
function contains(cells: bigint[] | BigUint64Array, cell: bigint): boolean;
```

#### Parameters

- `cells` **(bigint[] | BigUint64Array)** Sorted collection
- `cell` **(bigint)** Cell to test, at the collection's resolution

#### Return value

- **(boolean)** Whether the cell is in the collection

#### Example

```ts
import { polygonToCells, contains, lonLatToCell } from 'a5-js';

const coverage = polygonToCells(ring, 12);
const inside = contains(coverage, lonLatToCell([2.35, 48.85], 12));
```

### overlaps

Checks whether two collections share any cell. Both must be at the same resolution, or it throws.

```ts
function overlaps(a: bigint[] | BigUint64Array, b: bigint[] | BigUint64Array): boolean;
```

#### Parameters

- `a` **(bigint[] | BigUint64Array)** First collection
- `b` **(bigint[] | BigUint64Array)** Second collection

#### Return value

- **(boolean)** Whether some cell is in both collections

### count

Returns the number of cells a collection stands for at its resolution — the length of `uncompact(cells)`, computed without uncompacting. Note that this differs from the length of the compacted array. Every cell given is counted, so cells that overlap (e.g. two collections concatenated) are counted more than once; merge them with [`union`](#union) first.

```ts
function count(cells: bigint[] | BigUint64Array): bigint;
```

#### Parameters

- `cells` **(bigint[] | BigUint64Array)** A collection

#### Return value

- **(bigint)** Number of cells at the collection's resolution. A `bigint`, as it can exceed `Number.MAX_SAFE_INTEGER` at high resolutions

#### Example

```ts
import { polygonToCells, count } from 'a5-js';

// Stored compactly, as 78929 cells at mixed resolutions
const france = polygonToCells(franceRing, 16);
console.log(count(france));  // 67995098n cells at resolution 16
```

### area

Returns the area of a collection in square meters. As A5 cells are equal-area, this is exact: the number of cells times the [cell area](./cell-info#cellarea) at the collection's resolution. As with `count`, overlapping cells each add their area.

```ts
function area(cells: bigint[] | BigUint64Array): number;
```

#### Parameters

- `cells` **(bigint[] | BigUint64Array)** A collection

#### Return value

- **(number)** Area in square meters

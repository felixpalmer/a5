import Coverings from '/images/coverings.png';

# Coverings

A **covering** is a set of cells at one resolution, standing for an area of the globe, possibly in disjoint parts, such as the output of [`polygonToCells`](./indexing#polygontocells) or [`sphericalCap`](./traversal#sphericalcap). It is stored [compacted](./compaction), and in general should be used with methods expecting compacted data, if the actual cells are required (for example for a JOIN operation) a covering should be [uncompacted](./compaction#uncompact) first.

The functions on this page combine, query and measure coverings:

- [Set operations](#set-operations): [`union`](#union), [`intersect`](#intersect), [`difference`](#difference)
- [Predicates](#predicates): [`contains`](#contains), [`overlaps`](#overlaps)
- [Measures](#measures): [`count`](#count), [`area`](#area)

## Example processing flow

<img src={Coverings} style={{width: "100%", maxWidth: "600px"}}/>

```ts
import { polygonToCells, sphericalCap, lonLatToCell, intersect, area, contains } from 'a5-js';

// Construct coverings
const france = polygonToCells(francePolygon, 18); // 30ms -> 1.5 billion cells
const germany = polygonToCells(germanyPolygon, 18); // 30ms -> 1.9 billion cells
const nearBern = sphericalCap(bern, 18), 400_000); // 45ms -> 800 million cells
const nearLuxembourg = sphericalCap(luxembourg, 18), 150_000); // 45ms -> 400 million cells

// Set operations
const franceAndGermany = union(france, germany); // 4.5ms -> 3.3 billion cells
const alsoCloseToBern = intersect(franceAndGermany); // 7.3ms -> 500 million cells
const butFarFromLuxembourg = difference(alsoCloseToBern, nearLuxembourg); // 1.3ms -> 140 million cells

// Area of covering, accurate to 1m
console.log(area(butFarFromLuxembourg) / 1e6, 'km²'); // 1.2ms

// Point in polygon 
console.log(contains(butFarFromLuxembourg, munich)); // 4.3ms -> true
```

## Set operations

### union

Returns the cells in either covering. Both must be at the same resolution, or it throws.

```ts
function union(a: bigint[] | BigUint64Array, b: bigint[] | BigUint64Array): BigUint64Array;
```

#### Parameters

- `a` **(bigint[] | BigUint64Array)** First covering
- `b` **(bigint[] | BigUint64Array)** Second covering

#### Return value

- **(BigUint64Array)** Compacted cells sorted in curve order, then the compaction marker recording their resolution

#### Example

```ts
import { polygonToCells, union } from 'a5-js';

// A multi-polygon: the union of its parts
const coverage = union(polygonToCells(mainland, 10), polygonToCells(island, 10));
```

### intersect

Returns the cells in both coverings. Both must be at the same resolution, or it throws.

```ts
function intersect(a: bigint[] | BigUint64Array, b: bigint[] | BigUint64Array): BigUint64Array;
```

#### Parameters

- `a` **(bigint[] | BigUint64Array)** First covering
- `b` **(bigint[] | BigUint64Array)** Second covering

#### Return value

- **(BigUint64Array)** Compacted cells sorted in curve order, then the compaction marker recording their resolution

### difference

Returns the cells in the first covering but not in the second. Both must be at the same resolution, or it throws.

```ts
function difference(a: bigint[] | BigUint64Array, b: bigint[] | BigUint64Array): BigUint64Array;
```

#### Parameters

- `a` **(bigint[] | BigUint64Array)** Covering to subtract from
- `b` **(bigint[] | BigUint64Array)** Covering to subtract

#### Return value

- **(BigUint64Array)** Compacted cells sorted in curve order, then the compaction marker recording their resolution

#### Example

```ts
import { polygonToCells, difference, lonLatToCell, sphericalCap } from 'a5-js';

// A country without the area within 50 km of its capital
const outside = difference(polygonToCells(ring, 10), sphericalCap(lonLatToCell(capital, 10), 50_000));
```

## Predicates

### contains

Checks whether a cell is in a covering. The cell must be at the covering's resolution, or it throws: A5 cells don't nest geometrically across resolutions, so a finer cell isn't guaranteed to lie inside its ancestor. To test a point, index it at the covering's resolution with `lonLatToCell(point, resolution)`.

The test is a binary search, so the covering must be sorted in curve order, as returned by `compact`, `polygonToCells` and the other A5 functions. For speed, it checks only the cell and the covering cell the search lands on: a value elsewhere in the covering that is not a cell goes unnoticed.

```ts
function contains(cells: bigint[] | BigUint64Array, cell: bigint): boolean;
```

#### Parameters

- `cells` **(bigint[] | BigUint64Array)** Sorted covering
- `cell` **(bigint)** Cell to test, at the covering's resolution

#### Return value

- **(boolean)** Whether the cell is in the covering

#### Example

```ts
import { polygonToCells, contains, lonLatToCell } from 'a5-js';

const coverage = polygonToCells(ring, 12);
const inside = contains(coverage, lonLatToCell([2.35, 48.85], 12));
```

### overlaps

Checks whether two coverings share any cell. Both must be at the same resolution, or it throws.

```ts
function overlaps(a: bigint[] | BigUint64Array, b: bigint[] | BigUint64Array): boolean;
```

#### Parameters

- `a` **(bigint[] | BigUint64Array)** First covering
- `b` **(bigint[] | BigUint64Array)** Second covering

#### Return value

- **(boolean)** Whether some cell is in both coverings

## Measures

### count

Returns the number of cells a covering stands for at its resolution — the length of `uncompact(cells)`, computed without uncompacting. Note that this differs from the length of the compacted array. Every cell given is counted, so cells that overlap (e.g. two coverings concatenated) are counted more than once; merge them with [`union`](#union) first.

```ts
function count(cells: bigint[] | BigUint64Array): bigint;
```

#### Parameters

- `cells` **(bigint[] | BigUint64Array)** A covering

#### Return value

- **(bigint)** Number of cells at the covering's resolution. A `bigint`, as it can exceed `Number.MAX_SAFE_INTEGER` at high resolutions

#### Example

```ts
import { polygonToCells, count } from 'a5-js';

// Stored compactly, as 78929 cells at mixed resolutions
const france = polygonToCells(franceRing, 16);
console.log(count(france));  // 67995098n cells at resolution 16
```

### area

Returns the area of a covering in square meters. As A5 cells are equal-area, this is exact: the number of cells times the [cell area](./cell-info#cellarea) at the covering's resolution. As with `count`, overlapping cells each add their area.

```ts
function area(cells: bigint[] | BigUint64Array): number;
```

#### Parameters

- `cells` **(bigint[] | BigUint64Array)** A covering

#### Return value

- **(number)** Area in square meters

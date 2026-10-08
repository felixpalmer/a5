import Coverings from '/images/coverings.png';

# Coverings

A **covering** is a set of cells at one resolution, standing for an area of the globe, possibly in disjoint parts, such as the output of [`polygonToCells`](./indexing#polygontocells) or [`sphericalCap`](./traversal#sphericalcap). It is stored [compacted](./compaction), and in general should be used with methods expecting compacted data. If the actual cells are required (for example for a JOIN operation) a covering should be [uncompacted](./compaction#uncompact) first (warning: could use a huge amount of memory).

The functions on this page combine, query and measure coverings:

- [Set operations](#set-operations): [`union`](#union), [`intersect`](#intersect), [`difference`](#difference)
- [Predicates](#predicates): [`contains`](#contains), [`overlaps`](#overlaps)
- [Measures](#measures): [`count`](#count), [`area`](#area)

## Example processing flow

<img src={Coverings} style={{width: "100%", maxWidth: "600px"}}/>

```rust
// Construct coverings
let france = polygon_to_cells(&france_polygon, 18, None)?; // 944ms -> 1.09 billion cells
let germany = polygon_to_cells(&germany_polygon, 18, None)?; // 708ms -> 718 million cells
let near_bern = spherical_cap(bern, 400_000.0)?; // 302ms -> 1.02 billion cells
let near_luxembourg = spherical_cap(luxembourg, 150_000.0)?; // 113ms -> 143 million cells

// Set operations
let france_and_germany = union(&france, &germany)?; // 7.0ms -> 1.81 billion cells
let also_close_to_bern = intersect(&france_and_germany, &near_bern)?; // 5.4ms -> 646 million cells
let but_far_from_luxembourg = difference(&also_close_to_bern, &near_luxembourg)?; // 3.2ms -> 545 million cells

// Area of covering, to the nearest resolution 18 cell (~500m²)
println!("{} km²", area(&but_far_from_luxembourg)? / 1e6); // 1.4ms -> 269516 km²

// Point in polygon
println!("{}", contains(&but_far_from_luxembourg, munich)?); // 50ns -> true
```

Timings measured with the [Rust implementation](https://github.com/felixpalmer/a5-rs) on an Apple M1 Pro.

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

- **(BigUint64Array)** Combined covering of both input coverings

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

- **(BigUint64Array)** Covering of cell present in both input coverings

### difference

Returns the cells in the first covering but not in the second. Both must be at the same resolution, or it throws.

```ts
function difference(a: bigint[] | BigUint64Array, b: bigint[] | BigUint64Array): BigUint64Array;
```

#### Parameters

- `a` **(bigint[] | BigUint64Array)** Covering to subtract from
- `b` **(bigint[] | BigUint64Array)** Covering to subtract

#### Return value

- **(BigUint64Array)** Covering of cell present in first coverings, but not the second

#### Example

```ts
import { polygonToCells, difference, lonLatToCell, sphericalCap } from 'a5-js';

// A country without the area within 50 km of its capital
const outside = difference(polygonToCells(ring, 10), sphericalCap(lonLatToCell(capital, 10), 50_000));
```

## Predicates

### contains

Checks whether a cell is in a covering. The cell must be at the covering's resolution, or it throws: A5 cells don't nest geometrically across resolutions, so a finer cell isn't guaranteed to lie inside its ancestor. To test a point, index it at the covering's resolution with `lonLatToCell(point, resolution)`.

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

Returns the number of cells in a covering, equivalent to the length of `uncompact(cells)` without having to materialize the uncompacted cells. Note that this generally differs from the length of the compacted array.

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

Returns the area of a covering in square meters. As A5 cells are equal-area, this is exact: the number of cells times the [cell area](./cell-info#cellarea) at the covering's resolution.

```ts
function area(cells: bigint[] | BigUint64Array): number;
```

#### Parameters

- `cells` **(bigint[] | BigUint64Array)** A covering

#### Return value

- **(number)** Area in square meters

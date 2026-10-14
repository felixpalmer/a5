---
description: "Combine, test and measure coverings: union, intersect, difference, contains, overlaps, count and area."
---

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

<CodeTabs>

```ts
function union(a: bigint[] | BigUint64Array, b: bigint[] | BigUint64Array): BigUint64Array;
```

```python
def union(a: Cells, b: Cells) -> List[int]
```

```rust
pub fn union(a: &[u64], b: &[u64]) -> Result<Vec<u64>, String>
```

```sql unreleased
a5_union(a UBIGINT[], b UBIGINT[]) -> UBIGINT[]
```

```r unreleased
a5_union(x, y = NULL)
```

</CodeTabs>

#### Parameters

- `a` **(bigint[] | BigUint64Array)** First covering
- `b` **(bigint[] | BigUint64Array)** Second covering

#### Return value

- **(BigUint64Array)** Combined covering of both input coverings

#### Example

<CodeTabs>

```ts
import { polygonToCells, union } from 'a5-js';

// A multi-polygon: the union of its parts
const coverage = union(polygonToCells(mainland, 10), polygonToCells(island, 10));
```

```python
from a5 import polygon_to_cells, union

# A multi-polygon: the union of its parts
coverage = union(polygon_to_cells(mainland, 10), polygon_to_cells(island, 10))
```

```rust
use a5::{polygon_to_cells, union};

// A multi-polygon: the union of its parts
let coverage = union(
    &polygon_to_cells(&[mainland], 10, None)?,
    &polygon_to_cells(&[island], 10, None)?,
)?;
```

```sql unreleased
-- A multi-polygon: the union of its parts
SELECT a5_union(a5_geometry_to_cells(mainland, 10), a5_geometry_to_cells(island, 10)) AS coverage
FROM parts;
```

```r unreleased
library(a5R)

# A multi-polygon: the union of its parts
coverage <- a5_union(
  a5_polygon_to_cells(mainland, resolution = 10),
  a5_polygon_to_cells(island, resolution = 10)
)
```

</CodeTabs>

### intersect

Returns the cells in both coverings. Both must be at the same resolution, or it throws.

<CodeTabs>

```ts
function intersect(a: bigint[] | BigUint64Array, b: bigint[] | BigUint64Array): BigUint64Array;
```

```python
def intersect(a: Cells, b: Cells) -> List[int]
```

```rust
pub fn intersect(a: &[u64], b: &[u64]) -> Result<Vec<u64>, String>
```

```sql unreleased
a5_intersect(a UBIGINT[], b UBIGINT[]) -> UBIGINT[]
```

```r unreleased
a5_intersect(x, y)
```

</CodeTabs>

#### Parameters

- `a` **(bigint[] | BigUint64Array)** First covering
- `b` **(bigint[] | BigUint64Array)** Second covering

#### Return value

- **(BigUint64Array)** Covering of cell present in both input coverings

### difference

Returns the cells in the first covering but not in the second. Both must be at the same resolution, or it throws.

<CodeTabs>

```ts
function difference(a: bigint[] | BigUint64Array, b: bigint[] | BigUint64Array): BigUint64Array;
```

```python
def difference(a: Cells, b: Cells) -> List[int]
```

```rust
pub fn difference(a: &[u64], b: &[u64]) -> Result<Vec<u64>, String>
```

```sql unreleased
a5_difference(a UBIGINT[], b UBIGINT[]) -> UBIGINT[]
```

```r unreleased
a5_difference(x, y)
```

</CodeTabs>

#### Parameters

- `a` **(bigint[] | BigUint64Array)** Covering to subtract from
- `b` **(bigint[] | BigUint64Array)** Covering to subtract

#### Return value

- **(BigUint64Array)** Covering of cell present in first coverings, but not the second

#### Example

<CodeTabs>

```ts
import { polygonToCells, difference, lonLatToCell, sphericalCap } from 'a5-js';

// A country without the area within 50 km of its capital
const outside = difference(polygonToCells(ring, 10), sphericalCap(lonLatToCell(capital, 10), 50_000));
```

```python
from a5 import polygon_to_cells, difference, lonlat_to_cell, spherical_cap

# A country without the area within 50 km of its capital
outside = difference(polygon_to_cells(ring, 10), spherical_cap(lonlat_to_cell(capital, 10), 50_000))
```

```rust
use a5::{difference, lonlat_to_cell, polygon_to_cells, spherical_cap};

// A country without the area within 50 km of its capital
let outside = difference(
    &polygon_to_cells(&[ring], 10, None)?,
    &spherical_cap(lonlat_to_cell(capital, 10)?, 50_000.0)?,
)?;
```

```sql unreleased
-- A country without the area within 50 km of its capital
SELECT a5_difference(
  a5_geometry_to_cells(geom, 10),
  a5_spherical_cap(a5_lonlat_to_cell(capital_lon, capital_lat, 10), 50000)
) AS outside
FROM countries;
```

```r unreleased
library(a5R)

# A country without the area within 50 km of its capital
capital_cell <- a5_lonlat_to_cell(capital_lon, capital_lat, resolution = 10)
outside <- a5_difference(
  a5_polygon_to_cells(country, resolution = 10),
  a5_spherical_cap(capital_cell, radius = 50000)
)
```

</CodeTabs>

## Predicates

### contains

Checks whether a cell is in a covering. The cell must be at the covering's resolution, or it throws: A5 cells don't nest geometrically across resolutions, so a finer cell isn't guaranteed to lie inside its ancestor. To test a point, index it at the covering's resolution with `lonLatToCell(point, resolution)`.

<CodeTabs>

```ts
function contains(cells: bigint[] | BigUint64Array, cell: bigint): boolean;
```

```python
def contains(cells: Cells, cell: int) -> bool
```

```rust
pub fn contains(cells: &[u64], cell: u64) -> Result<bool, String>
```

```sql unreleased
a5_contains(cells UBIGINT[], cell UBIGINT) -> BOOLEAN
```

```r unreleased
a5_contains(x, cell)
```

</CodeTabs>

#### Parameters

- `cells` **(bigint[] | BigUint64Array)** Sorted covering
- `cell` **(bigint)** Cell to test, at the covering's resolution

#### Return value

- **(boolean)** Whether the cell is in the covering

#### Example

<CodeTabs>

```ts
import { polygonToCells, contains, lonLatToCell } from 'a5-js';

const coverage = polygonToCells(ring, 12);
const inside = contains(coverage, lonLatToCell([2.35, 48.85], 12));
```

```python
from a5 import polygon_to_cells, contains, lonlat_to_cell

coverage = polygon_to_cells(ring, 12)
inside = contains(coverage, lonlat_to_cell((2.35, 48.85), 12))
```

```rust
use a5::{contains, lonlat_to_cell, polygon_to_cells, LonLat};

let coverage = polygon_to_cells(&[ring], 12, None)?;
let inside = contains(&coverage, lonlat_to_cell(LonLat::new(2.35, 48.85), 12)?)?;
```

```sql unreleased
SELECT a5_contains(a5_geometry_to_cells(geom, 12), a5_lonlat_to_cell(2.35, 48.85, 12)) AS inside
FROM countries;
```

```r unreleased
library(a5R)

coverage <- a5_polygon_to_cells(country, resolution = 12)
inside <- a5_contains(coverage, a5_lonlat_to_cell(2.35, 48.85, resolution = 12))
```

</CodeTabs>

### overlaps

Checks whether two coverings share any cell. Both must be at the same resolution, or it throws.

<CodeTabs>

```ts
function overlaps(a: bigint[] | BigUint64Array, b: bigint[] | BigUint64Array): boolean;
```

```python
def overlaps(a: Cells, b: Cells) -> bool
```

```rust
pub fn overlaps(a: &[u64], b: &[u64]) -> Result<bool, String>
```

```sql unreleased
a5_overlaps(a UBIGINT[], b UBIGINT[]) -> BOOLEAN
```

```r unreleased
a5_overlaps(x, y)
```

</CodeTabs>

#### Parameters

- `a` **(bigint[] | BigUint64Array)** First covering
- `b` **(bigint[] | BigUint64Array)** Second covering

#### Return value

- **(boolean)** Whether some cell is in both coverings

## Measures

### count

Returns the number of cells in a covering, equivalent to the length of `uncompact(cells)` without having to materialize the uncompacted cells. Note that this generally differs from the length of the compacted array.

<CodeTabs>

```ts
function count(cells: bigint[] | BigUint64Array): bigint;
```

```python
def count(cells: Sequence[int]) -> int
```

```rust
pub fn count(cells: &[u64]) -> Result<u64, String>
```

```sql unreleased
a5_count(cells UBIGINT[]) -> UBIGINT
```

```r unreleased
a5_count(x)
```

</CodeTabs>

#### Parameters

- `cells` **(bigint[] | BigUint64Array)** A covering

#### Return value

- **(bigint)** Number of cells at the covering's resolution. A `bigint`, as it can exceed `Number.MAX_SAFE_INTEGER` at high resolutions

#### Example

<CodeTabs>

```ts
import { polygonToCells, count } from 'a5-js';

// Stored compactly, as 78929 cells at mixed resolutions
const france = polygonToCells(franceRing, 16);
console.log(count(france));  // 67995098n cells at resolution 16
```

```python
from a5 import polygon_to_cells, count

# Stored compactly, as 78929 cells at mixed resolutions
france = polygon_to_cells(france_ring, 16)
print(count(france))  # 67995098 cells at resolution 16
```

```rust
use a5::{count, polygon_to_cells};

// Stored compactly, as 78929 cells at mixed resolutions
let france = polygon_to_cells(&[france_ring], 16, None)?;
println!("{}", count(&france)?); // 67995098 cells at resolution 16
```

```sql unreleased
-- Stored compactly, as 78929 cells at mixed resolutions
SELECT a5_count(a5_geometry_to_cells(geom, 16))  -- 67995098 cells at resolution 16
FROM countries
WHERE name = 'France';
```

```r unreleased
library(a5R)

# Stored compactly, as 78929 cells at mixed resolutions
france <- a5_polygon_to_cells(france_polygon, resolution = 16)
a5_count(france)  # 67995098 cells at resolution 16
```

</CodeTabs>

### area

Returns the area of a covering in square meters. As A5 cells are equal-area, this is exact: the number of cells times the [cell area](./cell-info#cellarea) at the covering's resolution.

<CodeTabs>

```ts
function area(cells: bigint[] | BigUint64Array): number;
```

```python
def area(cells: Sequence[int]) -> float
```

```rust
pub fn area(cells: &[u64]) -> Result<f64, String>
```

```sql unreleased
a5_area(cells UBIGINT[]) -> DOUBLE
```

```r unreleased
a5_area(x, units = "m^2")
```

</CodeTabs>

#### Parameters

- `cells` **(bigint[] | BigUint64Array)** A covering

#### Return value

- **(number)** Area in square meters

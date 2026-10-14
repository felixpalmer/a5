# Compaction

Compaction is a way to efficiently represent a set of A5 cells by replacing groups of sibling cells with their parent cell. This reduces the number of cells needed to represent a region, while still standing for exactly the same set of cells.

For example, if you have all the children of a cell, you can represent them with just their parent cell. The `compact()` function performs this optimization, and `uncompact()` reverses it by expanding parent cells back into their children.

The result of a compaction is a [covering](https://a5geo.org/next/docs/api-reference/coverings.md), which automatically stores the resolution of the compacted cells in-band using a [compaction marker](#coverings-and-the-compaction-marker)

## Functions supporting compacted data

Many of the functions in the A5 API return and accept compacted data, and should be used whenever possible rather than using the more low-level functions below. See [here](https://a5geo.org/next/docs/api-reference/coverings.md#example-processing-flow) for an example.

- Indexing: [`polygonToCells`](https://a5geo.org/next/docs/api-reference/indexing.md#polygontocells)
- Hierarchy: [`cellToSubcell`](https://a5geo.org/next/docs/api-reference/hierarchy.md#celltosubcell)
- Traversal: [`gridDisk`](https://a5geo.org/next/docs/api-reference/traversal.md#griddisk), [`gridDiskVertex`](https://a5geo.org/next/docs/api-reference/traversal.md#griddiskvertex), [`sphericalCap`](https://a5geo.org/next/docs/api-reference/traversal.md#sphericalcap)
- Set operations: [`union`](https://a5geo.org/next/docs/api-reference/coverings.md#union), [`intersect`](https://a5geo.org/next/docs/api-reference/coverings.md#intersect), [`difference`](https://a5geo.org/next/docs/api-reference/coverings.md#difference)
- Predicates: [`contains`](https://a5geo.org/next/docs/api-reference/coverings.md#contains), [`overlaps`](https://a5geo.org/next/docs/api-reference/coverings.md#overlaps)
- Measures: [`count`](https://a5geo.org/next/docs/api-reference/coverings.md#count), [`area`](https://a5geo.org/next/docs/api-reference/coverings.md#area)

## Compaction helpers

### compact

Compacts a set of A5 cells by replacing complete groups of sibling cells with their parent cells, and appends the [compaction marker](#coverings-and-the-compaction-marker) recording the resolution of the finest input cell. In most cases users will use [polygonToCells](https://a5geo.org/next/docs/api-reference/indexing.md#polygontocells)

TypeScript / JavaScript:

```ts
function compact(cells: bigint[] | BigUint64Array): BigUint64Array;
```

Python:

```python
def compact(cells: Sequence[int]) -> List[int]
```

Rust:

```rust
pub fn compact(cells: &[u64]) -> Result<Vec<u64>, String>
```

DuckDB:

```sql
a5_compact(cells UBIGINT[]) -> UBIGINT[]
```

R (not yet released):

```r
a5_compact(cells, resolution = NULL)
```

#### Parameters

- `cells` **(bigint[] | BigUint64Array)** Array of A5 cell identifiers to compact

#### Return value

- **(BigUint64Array)** Compacted cells sorted in curve order, then the [compaction marker](#coverings-and-the-compaction-marker). An empty input returns an empty array.

#### Example

TypeScript / JavaScript:

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

Python:

```python
from a5 import compact, uncompact, count, covering_resolution, cell_to_children

# Get 4 sibling cells at resolution 3
parent = 0x6a80000000000000  # A cell at resolution 2
children = cell_to_children(parent)

# Compact them: they are stored as their parent, but still stand for 4 cells at resolution 3
compacted = compact(children)
print(count(compacted))  # 4
print(covering_resolution(compacted))  # 3
print(uncompact(compacted))  # the 4 children again
```

Rust:

```rust
use a5::{cell_to_children, compact, count, covering_resolution, uncompact};

// Get 4 sibling cells at resolution 3
let parent = 0x6a80000000000000; // A cell at resolution 2
let children = cell_to_children(parent, None)?;

// Compact them: they are stored as their parent, but still stand for 4 cells at resolution 3
let compacted = compact(&children)?;
println!("{}", count(&compacted)?); // 4
println!("{}", covering_resolution(&compacted)); // 3
println!("{:?}", uncompact(&compacted)?); // the 4 children again
```

DuckDB (not yet released):

```sql
-- Get 4 sibling cells at resolution 3, the children of a resolution 2 cell, and
-- compact them: they are stored as their parent, but still stand for 4 cells at resolution 3
WITH compacted AS (
  SELECT a5_compact(a5_cell_to_children(a5_hex_to_u64('6a80000000000000'))) AS cells
)
SELECT
  a5_count(cells),                -- 4
  a5_covering_resolution(cells),  -- 3
  a5_uncompact(cells)             -- the 4 children again
FROM compacted;
```

R (not yet released):

```r
library(a5R)

# Get 4 sibling cells at resolution 3
parent <- a5_cell("6a80000000000000")  # A cell at resolution 2
children <- a5_cell_to_children(parent)

# Compact them: they are stored as their parent, but still stand for 4 cells at resolution 3
compacted <- a5_compact(children)
a5_count(compacted)                # 4
a5_covering_resolution(compacted)  # 3
a5_uncompact(compacted)            # the 4 children again
```

### uncompact

Expands a covering to all of its cells at the covering's resolution: the resolution of its [compaction marker](#coverings-and-the-compaction-marker), or of its finest cell when it has none.

TypeScript / JavaScript:

```ts
function uncompact(cells: bigint[] | BigUint64Array): BigUint64Array;
```

Python:

```python
def uncompact(cells: Sequence[int]) -> List[int]
```

Rust:

```rust
pub fn uncompact(cells: &[u64]) -> Result<Vec<u64>, String>
```

DuckDB (not yet released):

```sql
a5_uncompact(cells UBIGINT[]) -> UBIGINT[]
```

R (not yet released):

```r
a5_uncompact(x, resolution = NULL, simplify = TRUE)
```

#### Parameters

- `cells` **(bigint[] | BigUint64Array)** A covering, as returned by `compact` or `polygonToCells`

#### Return value

- **(BigUint64Array)** Array of cell identifiers, all at the covering's resolution

#### Example

TypeScript / JavaScript:

```ts
import { polygonToCells, uncompact, getResolution } from 'a5-js';

const ring = [[2.25, 48.81], [2.42, 48.81], [2.42, 48.90], [2.25, 48.90]];
const compacted = polygonToCells(ring, 10);

// No resolution needed: the compaction marker records it
const flat = uncompact(compacted);
console.log(getResolution(flat[0]));  // 10
```

Python:

```python
from a5 import polygon_to_cells, uncompact, get_resolution

ring = [(2.25, 48.81), (2.42, 48.81), (2.42, 48.90), (2.25, 48.90)]
compacted = polygon_to_cells(ring, 10)

# No resolution needed: the compaction marker records it
flat = uncompact(compacted)
print(get_resolution(flat[0]))  # 10
```

Rust:

```rust
use a5::{get_resolution, polygon_to_cells, uncompact, LonLat};

let ring = vec![
    LonLat::new(2.25, 48.81),
    LonLat::new(2.42, 48.81),
    LonLat::new(2.42, 48.90),
    LonLat::new(2.25, 48.90),
];
let compacted = polygon_to_cells(&[ring], 10, None)?;

// No resolution needed: the compaction marker records it
let flat = uncompact(&compacted)?;
println!("{}", get_resolution(flat[0])); // 10
```

DuckDB (not yet released):

```sql
-- No resolution needed: the compaction marker records it
SELECT a5_get_resolution(cell)  -- 10
FROM (
  SELECT unnest(a5_uncompact(a5_geometry_to_cells(
    'POLYGON((2.25 48.81, 2.42 48.81, 2.42 48.90, 2.25 48.90, 2.25 48.81))'::GEOMETRY, 10
  ))) AS cell
)
LIMIT 1;
```

R (not yet released):

```r
library(a5R)

ring <- wk::wkt("POLYGON ((2.25 48.81, 2.42 48.81, 2.42 48.9, 2.25 48.9, 2.25 48.81))")
compacted <- a5_polygon_to_cells(ring, resolution = 10)

# No resolution needed: the compaction marker records it
flat <- a5_uncompact(compacted)
a5_get_resolution(flat[1])  # 10
```

#### Notes

- All output cells are at the covering's resolution; the [compaction marker](#coverings-and-the-compaction-marker) is not included
- The expansion is complete - every descendant cell at that resolution is included
- **Ordering property**: If the input is sorted in curve order (as `compact` returns it), the output is too. All children of a cell form a contiguous, ordered block on the curve, so `uncompact` on a covering produces sorted output without requiring a re-sort, which is useful for large result sets

### coveringResolution

Returns the resolution a covering stands for: the resolution of its [compaction marker](#coverings-and-the-compaction-marker), or of its finest cell when it has none.

TypeScript / JavaScript:

```ts
function coveringResolution(cells: bigint[] | BigUint64Array): number;
```

Python:

```python
def covering_resolution(cells: Sequence[int]) -> int
```

Rust:

```rust
pub fn covering_resolution(cells: &[u64]) -> i32
```

DuckDB (not yet released):

```sql
a5_covering_resolution(cells UBIGINT[]) -> INTEGER
```

R (not yet released):

```r
a5_covering_resolution(x)
```

#### Parameters

- `cells` **(bigint[] | BigUint64Array)** A covering, or any array of cells

#### Return value

- **(number)** Resolution (0–30), or -1 for an empty array or the [world cell](https://a5geo.org/next/docs/technical/index-encoding.md#special-case-world-cell)

#### Example

TypeScript / JavaScript:

```ts
import { compact, coveringResolution, cellToChildren } from 'a5-js';

const parent = 0x6a80000000000000n;  // resolution 2
const compacted = compact(cellToChildren(parent, 4));
console.log(coveringResolution(compacted));  // 4
```

Python:

```python
from a5 import compact, covering_resolution, cell_to_children

parent = 0x6a80000000000000  # resolution 2
compacted = compact(cell_to_children(parent, 4))
print(covering_resolution(compacted))  # 4
```

Rust:

```rust
use a5::{cell_to_children, compact, covering_resolution};

let parent = 0x6a80000000000000; // resolution 2
let compacted = compact(&cell_to_children(parent, Some(4))?)?;
println!("{}", covering_resolution(&compacted)); // 4
```

DuckDB (not yet released):

```sql
-- Children at resolution 4 of a resolution 2 cell
SELECT a5_covering_resolution(
  a5_compact(a5_cell_to_children(a5_hex_to_u64('6a80000000000000'), 4))
);  -- 4
```

R (not yet released):

```r
library(a5R)

parent <- a5_cell("6a80000000000000")  # resolution 2
compacted <- a5_compact(a5_cell_to_children(parent, resolution = 4))
a5_covering_resolution(compacted)  # 4
```

### isCompactionMarker

Checks whether a value is a [compaction marker](#coverings-and-the-compaction-marker), the value at the end of a covering that records its resolution. Most code never needs it: the A5 functions that read coverings handle the [compaction marker](#coverings-and-the-compaction-marker) themselves, and to get a covering's cells one at a time, use [`uncompact`](#uncompact). Always keep the [compaction marker](#coverings-and-the-compaction-marker) when you store or pass on a covering, as without it the compacted cells no longer say which resolution they stand for.

TypeScript / JavaScript:

```ts
function isCompactionMarker(value: bigint): boolean;
```

Python:

```python
def is_compaction_marker(value: int) -> bool
```

Rust:

```rust
pub fn is_compaction_marker(value: u64) -> bool
```

DuckDB (not yet released):

```sql
a5_is_compaction_marker(value UBIGINT) -> BOOLEAN
```

#### Parameters

- `value` **(bigint)** Value from a covering

#### Return value

- **(boolean)** Whether the value is a [compaction marker](#coverings-and-the-compaction-marker)

#### Example

TypeScript / JavaScript:

```ts
import { isCompactionMarker, lonLatToCell } from 'a5-js';

console.log(isCompactionMarker(lonLatToCell([2.35, 48.85], 10)));  // false: a cell
```

Python:

```python
from a5 import is_compaction_marker, lonlat_to_cell

print(is_compaction_marker(lonlat_to_cell((2.35, 48.85), 10)))  # False: a cell
```

Rust:

```rust
use a5::{is_compaction_marker, lonlat_to_cell, LonLat};

println!("{}", is_compaction_marker(lonlat_to_cell(LonLat::new(2.35, 48.85), 10)?)); // false: a cell
```

DuckDB (not yet released):

```sql
SELECT a5_is_compaction_marker(a5_lonlat_to_cell(2.35, 48.85, 10));  -- false: a cell
```

## Coverings and the compaction marker

A compacted array holds cells at mixed resolutions, but it stands for a set of cells at **one** resolution: compacting 8 cells at resolution 4 may leave 2 cells at resolution 3, which still mean those 8 cells. To keep that resolution, every compacted array ends with a **compaction marker**: a value in quintant 60 (only 0–59 exist), which no cell can take, recording the resolution of the set — for example `0xf00a000000000040` for resolution 10. We call such an array a *covering*, see [Coverings](https://a5geo.org/next/docs/api-reference/coverings.md) for the functions that combine, query and measure them.

- `uncompact` reads the compaction marker, so it needs no resolution argument.
- The array is still a plain `BigUint64Array` of 64-bit values, so a covering stores as a single list column in a database, Parquet or Arrow — the resolution travels with it.
- `cellToBoundary` returns `[]` for the compaction marker, so rendering a covering draws only its cells.
- An array without a compaction marker is a covering too: its resolution is that of its finest cell.

Read coverings only through the A5 functions, which handle the compaction marker for you, rather than indexing the array or taking its length: [`count`](https://a5geo.org/next/docs/api-reference/coverings.md#count) and [`area`](https://a5geo.org/next/docs/api-reference/coverings.md#area) measure a covering, [`contains`](https://a5geo.org/next/docs/api-reference/coverings.md#contains) tests a cell, [`uncompact`](#uncompact) lists its cells at its resolution, and [`coveringResolution`](#coveringresolution) gives that resolution.

`compact`, [`polygonToCells`](https://a5geo.org/next/docs/api-reference/indexing.md#polygontocells), [`gridDisk`](https://a5geo.org/next/docs/api-reference/traversal.md#griddisk), [`gridDiskVertex`](https://a5geo.org/next/docs/api-reference/traversal.md#griddiskvertex), [`sphericalCap`](https://a5geo.org/next/docs/api-reference/traversal.md#sphericalcap), [`cellToSubcell`](https://a5geo.org/next/docs/api-reference/hierarchy.md#celltosubcell) and the [set operations](https://a5geo.org/next/docs/api-reference/coverings.md) all return coverings. The cells come sorted in curve order (the order of the A5 space-filling curve), with the compaction marker last.

See [Bit Tags](https://a5geo.org/next/docs/technical/bit-tags.md#compaction-marker-encoding) for how the compaction marker is encoded.

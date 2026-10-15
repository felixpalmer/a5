# Traversal

Functions for finding neighboring cells and collecting cells within a range. See the [Traversal](https://a5geo.org/examples/traversal) example.

Each A5 cell has exactly 5 edge neighbors, which can be obtained using the `gridDisk` function. If the vertex neighbors are required, `gridDiskVertex` can be used. For broader range queries `sphericalCap` provides all the cells within a great-circle radius. To trace cells along a path, use [`lineStringToCells`](https://a5geo.org/docs/api-reference/indexing.md#linestringtocells).

In order to save memory, the returned cells from `gridDisk`, `gridDiskVertex` and `sphericalCap` are [compacted](https://a5geo.org/docs/api-reference/compaction.md) into a [covering](https://a5geo.org/docs/api-reference/coverings.md): the cells, then a [compaction marker](https://a5geo.org/docs/api-reference/compaction.md#coverings-and-the-compaction-marker) recording their resolution. Coverings can be combined with the [set operations](https://a5geo.org/docs/api-reference/coverings.md).

### gridDisk

Returns all cells within `k` edge-sharing hops of a center cell.

At each step, only edge-sharing neighbors (5 per cell) are followed.

The result is compacted — use [`uncompact`](https://a5geo.org/docs/api-reference/compaction.md#uncompact) to expand it to the resolution of the center cell.

TypeScript / JavaScript:

```ts
function gridDisk(cellId: bigint, k: number): BigUint64Array;
```

Python:

```python
def grid_disk(cell_id: int, k: int) -> List[int]
```

Rust:

```rust
pub fn grid_disk(cell_id: u64, k: usize) -> Result<Vec<u64>, String>
```

DuckDB:

```sql
a5_grid_disk(cell UBIGINT, k INTEGER) -> UBIGINT[]
```

R:

```r
a5_grid_disk(cell, k, vertex = FALSE)
```

#### Parameters

- `cellId` **(bigint)** Center A5 cell identifier
- `k` **(number)** Number of hops (0 returns just the center cell)

#### Return value

- **(BigUint64Array)** Compacted cells in the disk sorted in curve order, then the [compaction marker](https://a5geo.org/docs/api-reference/compaction.md#coverings-and-the-compaction-marker)

#### Example

TypeScript / JavaScript:

```ts
import { lonLatToCell, gridDisk, uncompact } from 'a5-js';

const cell = lonLatToCell([2.3522, 48.8566], 10);
const ring1 = gridDisk(cell, 1); // center + 5 edge neighbors (compacted)
const ring2 = uncompact(gridDisk(cell, 2)); // center + ring 1 + ring 2 (uncompacted)
```

Python:

```python
from a5 import lonlat_to_cell, grid_disk, uncompact

cell = lonlat_to_cell((2.3522, 48.8566), 10)
ring1 = grid_disk(cell, 1)  # center + 5 edge neighbors (compacted)
ring2 = uncompact(grid_disk(cell, 2))  # center + ring 1 + ring 2 (uncompacted)
```

Rust:

```rust
use a5::{grid_disk, lonlat_to_cell, uncompact, LonLat};

let cell = lonlat_to_cell(LonLat::new(2.3522, 48.8566), 10)?;
let ring1 = grid_disk(cell, 1)?; // center + 5 edge neighbors (compacted)
let ring2 = uncompact(&grid_disk(cell, 2)?)?; // center + ring 1 + ring 2 (uncompacted)
```

DuckDB (not yet released):

```sql
-- center + 5 edge neighbors (compacted)
SELECT a5_grid_disk(a5_lonlat_to_cell(2.3522, 48.8566, 10), 1) AS ring1;

-- center + ring 1 + ring 2 (uncompacted)
SELECT a5_uncompact(a5_grid_disk(a5_lonlat_to_cell(2.3522, 48.8566, 10), 2)) AS ring2;
```

R (not yet released):

```r
library(a5R)

cell <- a5_lonlat_to_cell(2.3522, 48.8566, resolution = 10)
ring1 <- a5_grid_disk(cell, k = 1)  # center + 5 edge neighbors (compacted)
ring2 <- a5_grid_disk(cell, k = 2) |> a5_uncompact()  # center + ring 1 + ring 2 (uncompacted)
```

### gridDiskVertex

Returns all cells within `k` hops of a center cell, following both edge-sharing and vertex-sharing neighbors.

The result is compacted — use [`uncompact`](https://a5geo.org/docs/api-reference/compaction.md#uncompact) to expand it to the resolution of the center cell.

TypeScript / JavaScript:

```ts
function gridDiskVertex(cellId: bigint, k: number): BigUint64Array;
```

Python:

```python
def grid_disk_vertex(cell_id: int, k: int) -> List[int]
```

Rust:

```rust
pub fn grid_disk_vertex(cell_id: u64, k: usize) -> Result<Vec<u64>, String>
```

DuckDB:

```sql
a5_grid_disk_vertex(cell UBIGINT, k INTEGER) -> UBIGINT[]
```

R:

```r
a5_grid_disk(cell, k, vertex = TRUE)
```

#### Parameters

- `cellId` **(bigint)** Center A5 cell identifier
- `k` **(number)** Number of hops (0 returns just the center cell)

#### Return value

- **(BigUint64Array)** Compacted cells in the disk sorted in curve order, then the [compaction marker](https://a5geo.org/docs/api-reference/compaction.md#coverings-and-the-compaction-marker)

### sphericalCap

Computes all cells whose centers fall within a great-circle radius from the center of a given cell.

The result is compacted — use [`uncompact`](https://a5geo.org/docs/api-reference/compaction.md#uncompact) to expand it to the resolution of the center cell.

TypeScript / JavaScript:

```ts
function sphericalCap(cellId: bigint, radius: number): BigUint64Array;
```

Python:

```python
def spherical_cap(cell_id: int, radius: float) -> List[int]
```

Rust:

```rust
pub fn spherical_cap(cell_id: u64, radius: f64) -> Result<Vec<u64>, String>
```

DuckDB:

```sql
a5_spherical_cap(cell UBIGINT, radius DOUBLE) -> UBIGINT[]
```

R:

```r
a5_spherical_cap(cell, radius)
```

#### Parameters

- `cellId` **(bigint)** Center A5 cell identifier
- `radius` **(number)** Radius in meters

#### Return value

- **(BigUint64Array)** Compacted cells sorted in curve order, then the [compaction marker](https://a5geo.org/docs/api-reference/compaction.md#coverings-and-the-compaction-marker)

#### Example

TypeScript / JavaScript:

```ts
import { lonLatToCell, sphericalCap, uncompact } from 'a5-js';

const cell = lonLatToCell([2.3522, 48.8566], 10);
const compact = sphericalCap(cell, 500_000); // 500 km
const flat = uncompact(compact); // all cells at resolution 10
```

Python:

```python
from a5 import lonlat_to_cell, spherical_cap, uncompact

cell = lonlat_to_cell((2.3522, 48.8566), 10)
compact = spherical_cap(cell, 500_000)  # 500 km
flat = uncompact(compact)  # all cells at resolution 10
```

Rust:

```rust
use a5::{lonlat_to_cell, spherical_cap, uncompact, LonLat};

let cell = lonlat_to_cell(LonLat::new(2.3522, 48.8566), 10)?;
let compact = spherical_cap(cell, 500_000.0)?; // 500 km
let flat = uncompact(&compact)?; // all cells at resolution 10
```

DuckDB (not yet released):

```sql
-- 500 km
SELECT a5_spherical_cap(a5_lonlat_to_cell(2.3522, 48.8566, 10), 500000) AS compact;

-- All cells at resolution 10
SELECT unnest(a5_uncompact(a5_spherical_cap(a5_lonlat_to_cell(2.3522, 48.8566, 10), 500000))) AS cell;
```

R (not yet released):

```r
library(a5R)

cell <- a5_lonlat_to_cell(2.3522, 48.8566, resolution = 10)
compact <- a5_spherical_cap(cell, radius = 500000)  # 500 km
flat <- a5_uncompact(compact)  # all cells at resolution 10
```

# Cell Info

Functions for obtaining information about A5 cells.

### getNumCells

Returns the number of cells at a given resolution level.

TypeScript / JavaScript:

```ts
function getNumCells(resolution: number): number;
```

Python:

```python
def get_num_cells(resolution: int) -> int
```

Rust:

```rust
pub fn get_num_cells(resolution: i32) -> u64
```

DuckDB:

```sql
a5_get_num_cells(resolution INTEGER) -> UBIGINT
```

R:

```r
a5_get_num_cells(resolution)
```

#### Parameters

- `resolution` **(number)** The resolution level

#### Return value

- **(number)** Number of cells at the given resolution

#### Example

TypeScript / JavaScript:

```ts
import { getNumCells } from 'a5-js';

console.log(getNumCells(0)); // 12
console.log(getNumCells(1)); // 60
console.log(getNumCells(2)); // 240
console.log(getNumCells(3)); // 960
```

Python:

```python
from a5 import get_num_cells

print(get_num_cells(0))  # 12
print(get_num_cells(1))  # 60
print(get_num_cells(2))  # 240
print(get_num_cells(3))  # 960
```

Rust:

```rust
use a5::get_num_cells;

println!("{}", get_num_cells(0)); // 12
println!("{}", get_num_cells(1)); // 60
println!("{}", get_num_cells(2)); // 240
println!("{}", get_num_cells(3)); // 960
```

DuckDB:

```sql
SELECT a5_get_num_cells(0);  -- 12
SELECT a5_get_num_cells(1);  -- 60
SELECT a5_get_num_cells(2);  -- 240
SELECT a5_get_num_cells(3);  -- 960
```

R:

```r
library(a5R)

a5_get_num_cells(0)  # 12
a5_get_num_cells(1)  # 60
a5_get_num_cells(2)  # 240
a5_get_num_cells(3)  # 960
```

### cellArea

Returns the area of a cell at a given resolution in square meters. Within a resolution level, all cells
have exactly the same area.

TypeScript / JavaScript:

```ts
function cellArea(resolution: number): number;
```

Python:

```python
def cell_area(resolution: int) -> float
```

Rust:

```rust
pub fn cell_area(resolution: i32) -> f64
```

DuckDB:

```sql
a5_cell_area(resolution INTEGER) -> DOUBLE
```

R:

```r
a5_cell_area(resolution, units = "m^2")
```

#### Parameters

- `resolution` **(number)** The resolution level

#### Return value

- **(number)** Area of a cell in square meters

#### Example

TypeScript / JavaScript:

```ts
import { cellArea } from 'a5-js';

console.log(cellArea(20)); // ~30 m²
```

Python:

```python
from a5 import cell_area

print(cell_area(20))  # ~30 m²
```

Rust:

```rust
use a5::cell_area;

println!("{}", cell_area(20)); // ~30 m²
```

DuckDB:

```sql
SELECT a5_cell_area(20);  -- ~30 m²
```

R:

```r
library(a5R)

a5_cell_area(20)  # ~30 [m^2]
```

### cellEdgeLengthAvg

Returns the average edge length of a cell at a given resolution in meters. Individual
edge lengths vary from the average by roughly ±10%, depending on the cell's
shape and its position on the globe.

TypeScript / JavaScript:

```ts
function cellEdgeLengthAvg(resolution: number): number;
```

Python:

```python
def cell_edge_length_avg(resolution: int) -> float
```

Rust:

```rust
pub fn cell_edge_length_avg(resolution: i32) -> f64
```

DuckDB (not yet released):

```sql
a5_cell_edge_length_avg(resolution INTEGER) -> DOUBLE
```

R:

```r
a5_cell_edge_length_avg(resolution, units = "m")
```

#### Parameters

- `resolution` **(number)** The resolution level

#### Return value

- **(number)** Average edge length of a cell in meters

#### Example

TypeScript / JavaScript:

```ts
import { cellEdgeLengthAvg } from 'a5-js';

console.log(cellEdgeLengthAvg(2)); // ~1,190,000 m
console.log(cellEdgeLengthAvg(10)); // ~4,680 m
```

Python:

```python
from a5 import cell_edge_length_avg

print(cell_edge_length_avg(2))  # ~1,190,000 m
print(cell_edge_length_avg(10))  # ~4,680 m
```

Rust:

```rust
use a5::cell_edge_length_avg;

println!("{}", cell_edge_length_avg(2)); // ~1,190,000 m
println!("{}", cell_edge_length_avg(10)); // ~4,680 m
```

DuckDB (not yet released):

```sql
SELECT a5_cell_edge_length_avg(2);   -- ~1,190,000 m
SELECT a5_cell_edge_length_avg(10);  -- ~4,680 m
```

R:

```r
library(a5R)

a5_cell_edge_length_avg(2)                # ~1,190,000 [m]
a5_cell_edge_length_avg(10, units = "km") # ~4.68 [km]
```

### isValidCell

Checks whether a 64-bit value is an A5 cell. Use it to validate cell IDs from outside sources, such as a file or a database, before passing them to other A5 functions. The [world cell](https://a5geo.org/next/docs/technical/index-encoding.md#special-case-world-cell) is a valid cell: it has no boundary, but `cellToParent` returns it as the parent of the resolution 0 cells. A [compaction marker](https://a5geo.org/next/docs/api-reference/compaction.md#coverings-and-the-compaction-marker) is not a cell.

TypeScript / JavaScript:

```ts
function isValidCell(index: bigint): boolean;
```

Python:

```python
def is_valid_cell(cell: int) -> bool
```

Rust:

```rust
pub fn is_valid_cell(cell: u64) -> bool
```

DuckDB:

```sql
a5_is_valid_cell(cell UBIGINT) -> BOOLEAN
```

R (not yet released):

```r
a5_is_valid_cell(x)  # a5_cell or hex strings
```

#### Parameters

- `index` **(bigint)** Value to check

#### Return value

- **(boolean)** Whether the value is an A5 cell identifier

#### Example

TypeScript / JavaScript:

```ts
import { isValidCell, lonLatToCell, hexToU64 } from 'a5-js';

console.log(isValidCell(lonLatToCell([2.35, 48.85], 10)));  // true
console.log(isValidCell(hexToU64('fd00000000000000')));     // false: resolution 1 has no quintant 63
```

Python:

```python
from a5 import is_valid_cell, lonlat_to_cell, hex_to_u64

print(is_valid_cell(lonlat_to_cell((2.35, 48.85), 10)))  # True
print(is_valid_cell(hex_to_u64('fd00000000000000')))     # False: resolution 1 has no quintant 63
```

Rust:

```rust
use a5::{hex_to_u64, is_valid_cell, lonlat_to_cell, LonLat};

println!("{}", is_valid_cell(lonlat_to_cell(LonLat::new(2.35, 48.85), 10)?)); // true
println!("{}", is_valid_cell(hex_to_u64("fd00000000000000")?));               // false: resolution 1 has no quintant 63
```

DuckDB:

```sql
SELECT a5_is_valid_cell(a5_lonlat_to_cell(2.35, 48.85, 10));  -- true
SELECT a5_is_valid_cell(a5_hex_to_u64('fd00000000000000'));   -- false: resolution 1 has no quintant 63
```

R (not yet released):

```r
library(a5R)

a5_is_valid_cell(a5_lonlat_to_cell(2.35, 48.85, resolution = 10))  # TRUE
a5_is_valid_cell("fd00000000000000")                               # FALSE: resolution 1 has no quintant 63
```

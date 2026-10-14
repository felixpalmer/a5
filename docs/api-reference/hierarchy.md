---
description: "Move between resolutions: getResolution, cellToParent, cellToChildren, cellToSupercell, cellToSubcell and getRes0Cells."
---

# Hierarchy

The A5 tiling system supports subdividing the world all the way from the 12 dodecahedron faces at resolution 0 to millimeter-scale leaf cells.

The cells are arranged in a logical hierarchy, with each cell having an integer resolution. Each cell has one parent cell at the previous resolution level and 4 child cells at the next resolution level, except at the ends of the hierarchy: the 12 resolution 0 cells, representing the dodecahedron faces, have 5 children each and the [world cell](../technical/index-encoding#special-case-world-cell) as their parent, while leaf cells at resolution 30 have no children.

### Parent and child cells overlap, they do not nest

The hierarchy is a logical grouping rather than an exact geometric containment. Pentagons cannot be subdivided into smaller pentagons, so a child cell overlaps its parent without lying entirely inside it: on average about 63% of a child's area falls within its parent, and at least about 7%, so no child ever lies entirely outside its parent. Treat `cellToParent`, `cellToChildren` and [compaction](./compaction) as a way of grouping nearby cells, not as an exact containment test.

The relationship is loosest between resolutions 1 and 2. Each resolution 1 cell is the single pentagon of its [quintant](../technical/platonic-solids#resolution-1), anchored at the center and a corner of the dodecahedron face and reaching into the neighboring quintants, while its four children are the resolution 2 cells that tile the quintant itself. On average about 58% of a child falls within its parent, rather than 63%, while the least-covered child still has about 7%, as at every other resolution. This is the price of keeping every cell a pentagon: the alternative, triangular resolution 1 cells, nests more closely but breaks the single cell shape and gives resolution 1 cells many awkward vertex-only neighbors.

### getResolution

Returns the resolution of an A5 cell

<CodeTabs>

```ts
function getResolution(index: bigint): number;
```

```python
def get_resolution(index: int) -> int
```

```rust
pub fn get_resolution(index: u64) -> i32
```

```sql
a5_get_resolution(cell UBIGINT) -> INTEGER
```

```r
a5_get_resolution(cell)
```

</CodeTabs>

#### Parameters

- `index` **(bigint)** A5 cell identifier

#### Return value

- **(number)** The resolution level of the cell

### cellToParent

Returns the parent cell of an A5 cell. 

<CodeTabs>

```ts
function cellToParent(index: bigint, parentResolution?: number): bigint;
```

```python
def cell_to_parent(index: int, parent_resolution: Optional[int] = None) -> int
```

```rust
pub fn cell_to_parent(index: u64, parent_resolution: Option<i32>) -> Result<u64, String>
```

```sql unreleased
a5_cell_to_parent(cell UBIGINT) -> UBIGINT
a5_cell_to_parent(cell UBIGINT, parent_resolution INTEGER) -> UBIGINT
```

```r
a5_cell_to_parent(cell, resolution = NULL)
```

</CodeTabs>

#### Parameters

- `index` **(bigint)** A5 cell identifier
- `parentResolution` **(number, optional)** By default one level coarser than input resolution.

#### Return value

- **(bigint)** The parent cell identifier

### cellToChildren

Returns the child cells of an A5 cell.

<CodeTabs>

```ts
function cellToChildren(index: bigint, childResolution?: number): bigint[];
```

```python
def cell_to_children(index: int, child_resolution: Optional[int] = None) -> List[int]
```

```rust
pub fn cell_to_children(index: u64, child_resolution: Option<i32>) -> Result<Vec<u64>, String>
```

```sql
a5_cell_to_children(cell UBIGINT) -> UBIGINT[]
a5_cell_to_children(cell UBIGINT, child_resolution INTEGER) -> UBIGINT[]
```

```r unreleased
a5_cell_to_children(cell, resolution = NULL, simplify = TRUE)
```

</CodeTabs>

#### Parameters

- `index` **(bigint)** A5 cell identifier
- `childResolution` **(number, optional)** By default one level finer than input resolution.

#### Return value

- **(bigint[])** Array of child cell identifiers

### Spatial hierarchy: subcells and supercells

Where the parent/child relationship groups cells by index, subcells and supercells group them by location: a finer cell belongs to the coarser cell that contains its center. Every cell at one resolution is then the subcell of exactly one cell at each coarser resolution, so aggregating fine data by supercell attributes each value to the coarse cell it actually lies in. This costs more than `cellToParent` / `cellToChildren`, which are pure bit operations.

### cellToSupercell

Returns the cell at a coarser resolution that contains the center of an A5 cell: the spatial counterpart of `cellToParent`.

<CodeTabs>

```ts
function cellToSupercell(index: bigint, resolution: number): bigint;
```

```python
def cell_to_supercell(cell: int, resolution: int) -> int
```

```rust
pub fn cell_to_supercell(cell: u64, resolution: i32) -> Result<u64, String>
```

```sql unreleased
a5_cell_to_supercell(cell UBIGINT, resolution INTEGER) -> UBIGINT
```

```r unreleased
a5_cell_to_supercell(cell, resolution = NULL)
```

</CodeTabs>

#### Parameters

- `index` **(bigint)** A5 cell identifier
- `resolution` **(number)** Target resolution, at most the cell's own

#### Return value

- **(bigint)** The cell at `resolution` containing the center of `index`

### cellToSubcell

Returns the cells at a finer resolution whose centers lie in an A5 cell: the spatial counterpart of `cellToChildren`, and the inverse of `cellToSupercell`. Like the other functions returning a [covering](./coverings), the result is compacted, ending with a [compaction marker](./compaction#coverings-and-the-compaction-marker) recording the resolution.

<CodeTabs>

```ts
function cellToSubcell(index: bigint, resolution: number): BigUint64Array;
```

```python
def cell_to_subcell(cell: int, resolution: int) -> List[int]
```

```rust
pub fn cell_to_subcell(cell: u64, resolution: i32) -> Result<Vec<u64>, String>
```

```sql unreleased
a5_cell_to_subcell(cell UBIGINT, resolution INTEGER) -> UBIGINT[]
```

```r unreleased
a5_cell_to_subcell(cell, resolution = NULL)
```

</CodeTabs>

#### Parameters

- `index` **(bigint)** A5 cell identifier
- `resolution` **(number)** Target resolution, at least the cell's own

#### Return value

- **(BigUint64Array)** Compacted subcells sorted in curve order, then the [compaction marker](./compaction#coverings-and-the-compaction-marker) — use [`uncompact`](./compaction#uncompact) to expand them. Resolution 30 covers only part of the world, so for a cell reaching past it the subcells are given at resolution 29.

#### Example

<CodeTabs>

```ts
import { cellToSubcell, cellToSupercell, lonLatToCell, uncompact } from 'a5-js';

const cell = lonLatToCell([2.35, 48.85], 8);
const subcells = uncompact(cellToSubcell(cell, 11));
subcells.every(subcell => cellToSupercell(subcell, 8) === cell); // true
```

```python
from a5 import cell_to_subcell, cell_to_supercell, lonlat_to_cell, uncompact

cell = lonlat_to_cell((2.35, 48.85), 8)
subcells = uncompact(cell_to_subcell(cell, 11))
all(cell_to_supercell(subcell, 8) == cell for subcell in subcells)  # True
```

```rust
use a5::{cell_to_subcell, cell_to_supercell, lonlat_to_cell, uncompact, LonLat};

let cell = lonlat_to_cell(LonLat::new(2.35, 48.85), 8)?;
let subcells = uncompact(&cell_to_subcell(cell, 11)?)?;
subcells.iter().all(|&subcell| cell_to_supercell(subcell, 8) == Ok(cell)); // true
```

```sql unreleased
SELECT bool_and(a5_cell_to_supercell(subcell, 8) = cell)  -- true
FROM (
  SELECT cell, unnest(a5_uncompact(a5_cell_to_subcell(cell, 11))) AS subcell
  FROM (SELECT a5_lonlat_to_cell(2.35, 48.85, 8) AS cell)
);
```

```r unreleased
library(a5R)

cell <- a5_lonlat_to_cell(2.35, 48.85, resolution = 8)
subcells <- a5_uncompact(a5_cell_to_subcell(cell, resolution = 11))
all(a5_cell_to_supercell(subcells, resolution = 8) == cell)  # TRUE
```

</CodeTabs>

### getRes0Cells

Returns resolution 0 cells of the A5 system, which serve as a starting point for all higher-resolution subdivisions in the hierarchy.

<CodeTabs>

```ts
function getRes0Cells(): bigint[];
```

```python
def get_res0_cells() -> List[int]
```

```rust
pub fn get_res0_cells() -> Result<Vec<u64>, String>
```

```sql
a5_get_res0_cells() -> UBIGINT[]
```

```r
a5_get_res0_cells()
```

</CodeTabs>

#### Return value

- **(bigint[])** Array of 12 A5 cell identifiers

#### Example

<CodeTabs>

```ts
import { getRes0Cells, cellToChildren } from 'a5-js';

const res0Cells = getRes0Cells();
const res1Cells = res0Cells.flatMap(cell => cellToChildren(cell, 1))
```

```python
from a5 import get_res0_cells, cell_to_children

res0_cells = get_res0_cells()
res1_cells = [child for cell in res0_cells for child in cell_to_children(cell, 1)]
```

```rust
use a5::{cell_to_children, get_res0_cells};

let res0_cells = get_res0_cells()?;
let mut res1_cells = Vec::new();
for cell in res0_cells {
    res1_cells.extend(cell_to_children(cell, Some(1))?);
}
```

```sql
SELECT unnest(a5_cell_to_children(cell, 1)) AS cell
FROM (SELECT unnest(a5_get_res0_cells()) AS cell);
```

```r unreleased
library(a5R)

res0_cells <- a5_get_res0_cells()
res1_cells <- a5_cell_to_children(res0_cells, resolution = 1)
```

</CodeTabs>
# Indexing

Functions for converting between geospatial coordinates and A5 indices.

Coordinates are specified as per the [GeoJSON spec](https://www.rfc-editor.org/rfc/rfc7946#section-3.1.1), namely: `[longitude, latitude]`.

:::info
For detailed information about how A5 encodes cells as 64-bit integers, see [Index Encoding](https://a5geo.org/docs/technical/index-encoding.md).
:::

### lonLatToCell

Indexes the coordinate at a given resolution to an A5 cell index.

TypeScript / JavaScript:

```ts
function lonLatToCell(coordinate: [longitude: number, latitude: number], resolution: number): bigint;
```

Python:

```python
def lonlat_to_cell(lon_lat: LonLat, resolution: int) -> int
```

Rust:

```rust
pub fn lonlat_to_cell(lonlat: LonLat, resolution: i32) -> Result<u64, String>
```

DuckDB:

```sql
a5_lonlat_to_cell(longitude DOUBLE, latitude DOUBLE, resolution INTEGER) -> UBIGINT
```

R:

```r
a5_lonlat_to_cell(lon, lat, resolution)
```

#### Parameters

- `coordinate` **(number[])** coordinate as `[longitude, latitude]`
- `resolution` **(number)** The resolution level to index at

#### Return value

- **(bigint)** The A5 cell identifier

### cellToLonLat

Returns the geospatial coordinate at the center of an A5 cell.

TypeScript / JavaScript:

```ts
function cellToLonLat(cell: bigint): [longitude: number, latitude: number];
```

Python:

```python
def cell_to_lonlat(cell_id: int) -> LonLat
```

Rust:

```rust
pub fn cell_to_lonlat(cell: u64) -> Result<LonLat, String>
```

DuckDB:

```sql
a5_cell_to_lonlat(cell UBIGINT) -> DOUBLE[2]

-- As a GEOMETRY point
a5_cell_to_point(cell UBIGINT) -> GEOMETRY
```

R:

```r
a5_cell_to_lonlat(cell, as_dataframe = FALSE)
```

#### Parameters

- `cell` **(bigint)** A5 cell identifier

#### Return value

- **(number[])** The center coordinate as `[longitude, latitude]`

### cellToBoundary

Returns the vertices that define the boundary of an A5 cell.

TypeScript / JavaScript:

```ts
function cellToBoundary(cell: bigint, options?: {
  closedRing?: boolean;
  segments?: number | 'auto';
}): [longitude: number, latitude: number][];
```

Python:

```python
def cell_to_boundary(cell_id: int, options: Optional[CellToBoundaryOptions] = None) -> List[LonLat]

# options: {'closed_ring': bool, 'segments': int | 'auto'}
```

Rust:

```rust
pub fn cell_to_boundary(cell_id: u64, options: Option<CellToBoundaryOptions>) -> Result<Vec<LonLat>, String>

pub struct CellToBoundaryOptions {
    pub closed_ring: bool,
    pub segments: Option<i32>, // None for auto
}
```

DuckDB:

```sql
a5_cell_to_boundary(cell UBIGINT) -> DOUBLE[2][]
a5_cell_to_boundary(cell UBIGINT, closed_ring BOOLEAN) -> DOUBLE[2][]
a5_cell_to_boundary(cell UBIGINT, closed_ring BOOLEAN, segments INTEGER) -> DOUBLE[2][]

-- As a GEOMETRY polygon
a5_cell_to_geometry(cell UBIGINT) -> GEOMETRY
a5_cell_to_geometry(cell UBIGINT, segments INTEGER) -> GEOMETRY
```

R:

```r
a5_cell_to_boundary(cell, format = c("wkb", "wkt"), closed = TRUE, segments = NULL)
```

#### Parameters

- `cell` **(bigint)** A5 cell identifier
- `options` **(object)** Optional configuration object
  - `closedRing` **(boolean)** Whether to close the ring by repeating the first point at the end. Defaults to `true`.
  - `segments` **(number | 'auto')** Number of segments to use for each edge. When set to 'auto', uses a resolution-appropriate value. Defaults to 'auto'.

#### Return value

- **(number[][])** Array of coordinates defining the cell boundary, each as `[longitude, latitude]`

### polygonToCells

Returns all cells within a polygon, defined either by a single ring of `[longitude, latitude]` vertices or by GeoJSON-style rings `[outer, ...holes]`. Cells inside a hole are excluded.

Rings may be open or closed (GeoJSON-style, with the first vertex repeated at the end) — closure is automatic either way. Either winding order is accepted; the orientation is detected from the ring geometry. Hole rings with fewer than 3 distinct vertices are ignored.

The `containment` option controls which cells count as belonging to the polygon:

- `'center'` (default) — a cell is included only if its center lies inside the polygon. Adjacent polygons that share an edge produce disjoint coverings, so this is the right choice for partitioning.
- `'overlapping'` — additionally includes every cell that overlaps the polygon boundary. The result is a superset of `'center'` that fully covers the polygon with no gaps, at the cost of some overlap with adjacent polygons. Use this when a query must not miss any cell touching the polygon (for example, filtering database rows by cell before applying an exact geometry test).

The result is a [covering](https://a5geo.org/docs/api-reference/coverings.md) of the polygon, approximating it with `'center'` and containing it with `'overlapping'`: compacted cells, then a [compaction marker](https://a5geo.org/docs/api-reference/compaction.md#coverings-and-the-compaction-marker) recording the resolution. Use [`uncompact`](https://a5geo.org/docs/api-reference/compaction.md#uncompact) to expand it to the input resolution. The compacted form is intended for storage, transfer and set operations: cell boundaries of different resolutions do not nest geometrically, so the mixed-resolution cells of a covering will show overlaps and gaps when rendered. Uncompact to a single resolution before drawing cells on a map.

Multi-polygons are not supported directly — call `polygonToCells` per polygon and combine the results with [`union`](https://a5geo.org/docs/api-reference/coverings.md#union). Coverings can also be intersected, subtracted and tested for containment without uncompacting, see [Coverings](https://a5geo.org/docs/api-reference/coverings.md).

TypeScript / JavaScript:

```ts
function polygonToCells(polygon: LonLat[] | LonLat[][], resolution: number, options?: {
  containment?: 'center' | 'overlapping';
}): BigUint64Array;
```

Python:

```python
def polygon_to_cells(polygon: Sequence[LonLat] | Sequence[Sequence[LonLat]], resolution: int, options: Optional[PolygonToCellsOptions] = None) -> List[int]

# options: {'containment': 'center' | 'overlapping'}
```

Rust:

```rust
pub fn polygon_to_cells(polygon: &[Vec<LonLat>], resolution: i32, options: Option<PolygonToCellsOptions>) -> Result<Vec<u64>, String>

pub struct PolygonToCellsOptions {
    pub containment: Containment, // Containment::Center (default) or Containment::Overlapping
}
```

DuckDB:

```sql
a5_geometry_to_cells(geom GEOMETRY, resolution INTEGER) -> UBIGINT[]
a5_geometry_to_cells(geom GEOMETRY, resolution INTEGER, overlapping BOOLEAN) -> UBIGINT[]
```

R:

```r
a5_polygon_to_cells(x, resolution, containment = c("centre", "overlapping"))
```

#### Parameters

- `polygon` **(LonLat[] | LonLat[][])** Either a single ring of `[longitude, latitude]` vertices, or an array of rings where the first ring is the outer boundary and subsequent rings are holes. The outer ring must contain at least 3 vertices.
- `resolution` **(number)** Target resolution (0–30)
- `options` **(object)** Optional configuration object
  - `containment` **('center' | 'overlapping')** Which cells to include relative to the polygon. `'center'` includes a cell only if its center is inside; `'overlapping'` also includes cells that touch the polygon, for gap-free coverage. Defaults to `'center'`.

#### Return value

- **(BigUint64Array)** Compacted cells belonging to the polygon sorted in curve order, then the [compaction marker](https://a5geo.org/docs/api-reference/compaction.md#coverings-and-the-compaction-marker). A polygon with no cells gives just the [compaction marker](https://a5geo.org/docs/api-reference/compaction.md#coverings-and-the-compaction-marker)

#### Example

TypeScript / JavaScript:

```ts
import { polygonToCells, uncompact } from 'a5-js';

// Bounding box around central Paris
const ring = [
  [2.25, 48.81],
  [2.42, 48.81],
  [2.42, 48.90],
  [2.25, 48.90]
];
const compact = polygonToCells(ring, 10);
const flat = uncompact(compact); // all cells at resolution 10

// The same polygon with a hole — cells inside the hole are excluded
const hole = [
  [2.30, 48.84],
  [2.37, 48.84],
  [2.37, 48.87],
  [2.30, 48.87]
];
const withHole = polygonToCells([ring, hole], 10);

// Full coverage — every cell overlapping the polygon, with no gaps along the edge
const covering = polygonToCells(ring, 10, { containment: 'overlapping' });
```

Python:

```python
from a5 import polygon_to_cells, uncompact

# Bounding box around central Paris
ring = [
    (2.25, 48.81),
    (2.42, 48.81),
    (2.42, 48.90),
    (2.25, 48.90),
]
compact = polygon_to_cells(ring, 10)
flat = uncompact(compact)  # all cells at resolution 10

# The same polygon with a hole — cells inside the hole are excluded
hole = [
    (2.30, 48.84),
    (2.37, 48.84),
    (2.37, 48.87),
    (2.30, 48.87),
]
with_hole = polygon_to_cells([ring, hole], 10)

# Full coverage — every cell overlapping the polygon, with no gaps along the edge
covering = polygon_to_cells(ring, 10, {'containment': 'overlapping'})
```

Rust:

```rust
use a5::{polygon_to_cells, uncompact, Containment, LonLat, PolygonToCellsOptions};

// Bounding box around central Paris
let ring = vec![
    LonLat::new(2.25, 48.81),
    LonLat::new(2.42, 48.81),
    LonLat::new(2.42, 48.90),
    LonLat::new(2.25, 48.90),
];
let compact = polygon_to_cells(&[ring.clone()], 10, None)?;
let flat = uncompact(&compact)?; // all cells at resolution 10

// The same polygon with a hole — cells inside the hole are excluded
let hole = vec![
    LonLat::new(2.30, 48.84),
    LonLat::new(2.37, 48.84),
    LonLat::new(2.37, 48.87),
    LonLat::new(2.30, 48.87),
];
let with_hole = polygon_to_cells(&[ring.clone(), hole], 10, None)?;

// Full coverage — every cell overlapping the polygon, with no gaps along the edge
let options = PolygonToCellsOptions { containment: Containment::Overlapping };
let covering = polygon_to_cells(&[ring], 10, Some(options))?;
```

DuckDB:

```sql
-- Bounding box around central Paris
SELECT a5_geometry_to_cells(
  'POLYGON((2.25 48.81, 2.42 48.81, 2.42 48.90, 2.25 48.90, 2.25 48.81))'::GEOMETRY, 10
) AS compact;

-- All cells at resolution 10
SELECT unnest(a5_uncompact(a5_geometry_to_cells(
  'POLYGON((2.25 48.81, 2.42 48.81, 2.42 48.90, 2.25 48.90, 2.25 48.81))'::GEOMETRY, 10
))) AS cell;

-- The same polygon with a hole — cells inside the hole are excluded
SELECT a5_geometry_to_cells(
  'POLYGON((2.25 48.81, 2.42 48.81, 2.42 48.90, 2.25 48.90, 2.25 48.81),
           (2.30 48.84, 2.37 48.84, 2.37 48.87, 2.30 48.87, 2.30 48.84))'::GEOMETRY, 10
) AS with_hole;

-- Full coverage — every cell overlapping the polygon, with no gaps along the edge
SELECT a5_geometry_to_cells(
  'POLYGON((2.25 48.81, 2.42 48.81, 2.42 48.90, 2.25 48.90, 2.25 48.81))'::GEOMETRY, 10, true
) AS covering;
```

R:

```r
library(a5R)

# Bounding box around central Paris
paris <- wk::wkt("POLYGON ((2.25 48.81, 2.42 48.81, 2.42 48.9, 2.25 48.9, 2.25 48.81))")
compact <- a5_polygon_to_cells(paris, resolution = 10)
flat <- a5_uncompact(compact)  # all cells at resolution 10

# The same polygon with a hole — cells inside the hole are excluded
with_hole <- a5_polygon_to_cells(wk::wkt(
  "POLYGON ((2.25 48.81, 2.42 48.81, 2.42 48.9, 2.25 48.9, 2.25 48.81),
            (2.3 48.84, 2.37 48.84, 2.37 48.87, 2.3 48.87, 2.3 48.84))"
), resolution = 10)

# Full coverage — every cell overlapping the polygon, with no gaps along the edge
covering <- a5_polygon_to_cells(paris, resolution = 10, containment = "overlapping")
```

### lineStringToCells

Returns all cells whose pentagons intersect a polyline defined by a sequence of waypoints. Consecutive waypoints are connected with great-circle arcs. For a simple two-point line segment, pass `[start, end]`.

The result is uncompacted at the requested resolution and is not sorted — cells appear roughly in the order they were discovered along the path. Cells at waypoint junctions are deduplicated.

TypeScript / JavaScript:

```ts
function lineStringToCells(waypoints: LonLat[], resolution: number): bigint[];
```

Python:

```python
def line_string_to_cells(waypoints: List[LonLat], resolution: int) -> List[int]
```

Rust:

```rust
pub fn line_string_to_cells(waypoints: &[LonLat], resolution: i32) -> Result<Vec<u64>, String>
```

DuckDB:

```sql
a5_geometry_to_cells(geom GEOMETRY, resolution INTEGER) -> UBIGINT[]  -- geom a LINESTRING
```

R:

```r
a5_linestring_to_cells(x, resolution)
```

#### Parameters

- `waypoints` **(LonLat[])** Polyline vertices, each as `[longitude, latitude]`
- `resolution` **(number)** Target resolution (0–30)

#### Return value

- **(bigint[])** Array of unique cell identifiers whose pentagons intersect the polyline

#### Example

TypeScript / JavaScript:

```ts
import { lineStringToCells } from 'a5-js';

// Simple segment: Paris → London
const segment = lineStringToCells([[2.3522, 48.8566], [-0.1276, 51.5074]], 8);

// Multi-waypoint route
const route = [
  [2.3522, 48.8566], // Paris
  [4.8357, 45.7640], // Lyon
  [7.2620, 43.7102]  // Nice
];
const cells = lineStringToCells(route, 8);
```

Python:

```python
from a5 import line_string_to_cells

# Simple segment: Paris → London
segment = line_string_to_cells([(2.3522, 48.8566), (-0.1276, 51.5074)], 8)

# Multi-waypoint route
route = [
    (2.3522, 48.8566),  # Paris
    (4.8357, 45.7640),  # Lyon
    (7.2620, 43.7102),  # Nice
]
cells = line_string_to_cells(route, 8)
```

Rust:

```rust
use a5::{line_string_to_cells, LonLat};

// Simple segment: Paris → London
let segment = line_string_to_cells(&[LonLat::new(2.3522, 48.8566), LonLat::new(-0.1276, 51.5074)], 8)?;

// Multi-waypoint route
let route = [
    LonLat::new(2.3522, 48.8566), // Paris
    LonLat::new(4.8357, 45.7640), // Lyon
    LonLat::new(7.2620, 43.7102), // Nice
];
let cells = line_string_to_cells(&route, 8)?;
```

DuckDB:

```sql
-- Simple segment: Paris → London
SELECT a5_geometry_to_cells('LINESTRING(2.3522 48.8566, -0.1276 51.5074)'::GEOMETRY, 8) AS segment;

-- Multi-waypoint route: Paris → Lyon → Nice
SELECT a5_geometry_to_cells(
  'LINESTRING(2.3522 48.8566, 4.8357 45.7640, 7.2620 43.7102)'::GEOMETRY, 8
) AS cells;
```

R:

```r
library(a5R)

# Simple segment: Paris → London
segment <- a5_linestring_to_cells(wk::wkt("LINESTRING (2.3522 48.8566, -0.1276 51.5074)"), resolution = 8)

# Multi-waypoint route: Paris → Lyon → Nice
route <- wk::wkt("LINESTRING (2.3522 48.8566, 4.8357 45.764, 7.262 43.7102)")
cells <- a5_linestring_to_cells(route, resolution = 8)
```

## Cell representation

A5 cells are stored as 64 bit integers, for performance and to provide a compact representation for use in databases. In JavaScript these can be represented as [BigInt](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt) values and arrays of cells stored as [BigUint64Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigUint64Array)s.

For best performance it is recommended to use this representation, but it is also possible to convert them into hexadecimal, for example to encode them in JSON (which does _not_ support 64 bit integers). Two helper functions are provided for this conversion.

### u64ToHex

TypeScript / JavaScript:

```ts
function u64ToHex(index: bigint): string;
```

Python:

```python
def u64_to_hex(value: int) -> str
```

Rust:

```rust
pub fn u64_to_hex(value: u64) -> String
```

DuckDB:

```sql
a5_u64_to_hex(cell UBIGINT) -> VARCHAR
```

R:

```r
a5_u64_to_hex(x)
```

#### Parameters

- `index` **(bigint)** A5 cell identifier

#### Return value

- **(string)** Hexadecimal string representation of the cell identifier

### hexToU64

TypeScript / JavaScript:

```ts
function hexToU64(hex: string): bigint;
```

Python:

```python
def hex_to_u64(hex_str: str) -> int
```

Rust:

```rust
pub fn hex_to_u64(hex: &str) -> Result<u64, String>
```

DuckDB:

```sql
a5_hex_to_u64(hex VARCHAR) -> UBIGINT
```

R:

```r
a5_hex_to_u64(x)  # returns an a5_cell
```

#### Parameters

- `hex` **(string)** Hexadecimal string representation of an A5 cell identifier

#### Return value

- **(bigint)** The A5 cell identifier

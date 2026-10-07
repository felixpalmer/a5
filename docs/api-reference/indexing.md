# Indexing

Functions for converting between geospatial coordinates and A5 indices.

Coordinates are specified as per the [GeoJSON spec](https://www.rfc-editor.org/rfc/rfc7946#section-3.1.1), namely: `[longitude, latitude]`.

:::info
For detailed information about how A5 encodes cells as 64-bit integers, see [Index Encoding](../technical/index-encoding).
:::

### lonLatToCell

Indexes the coordinate at a given resolution to an A5 cell index.

```ts
function lonLatToCell(coordinate: [longitude: number, latitude: number], resolution: number): bigint;
```

#### Parameters

- `coordinate` **(number[])** coordinate as `[longitude, latitude]`
- `resolution` **(number)** The resolution level to index at

#### Return value

- **(bigint)** The A5 cell identifier

### cellToLonLat

Returns the geospatial coordinate at the center of an A5 cell.

```ts
function cellToLonLat(cell: bigint): [longitude: number, latitude: number];
```

#### Parameters

- `cell` **(bigint)** A5 cell identifier

#### Return value

- **(number[])** The center coordinate as `[longitude, latitude]`

### cellToBoundary

Returns the vertices that define the boundary of an A5 cell.

```ts
function cellToBoundary(cell: bigint, options?: {
  closedRing?: boolean;
  segments?: number | 'auto';
}): [longitude: number, latitude: number][];
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

The result is a [covering](./coverings) of the polygon, approximating it with `'center'` and containing it with `'overlapping'`: compacted cells, then a compaction marker recording the resolution. Use [`uncompact`](./compaction#uncompact) to expand it to the input resolution. The compacted form is intended for storage, transfer and set operations: cell boundaries of different resolutions do not nest geometrically, so the mixed-resolution cells of a covering will show overlaps and gaps when rendered. Uncompact to a single resolution before drawing cells on a map.

Multi-polygons are not supported directly — call `polygonToCells` per polygon and combine the results with [`union`](./coverings#union). Coverings can also be intersected, subtracted and tested for containment without uncompacting, see [Coverings](./coverings).

```ts
function polygonToCells(polygon: LonLat[] | LonLat[][], resolution: number, options?: {
  containment?: 'center' | 'overlapping';
}): BigUint64Array;
```

#### Parameters

- `polygon` **(LonLat[] | LonLat[][])** Either a single ring of `[longitude, latitude]` vertices, or an array of rings where the first ring is the outer boundary and subsequent rings are holes. The outer ring must contain at least 3 vertices.
- `resolution` **(number)** Target resolution (0–30)
- `options` **(object)** Optional configuration object
  - `containment` **('center' | 'overlapping')** Which cells to include relative to the polygon. `'center'` includes a cell only if its center is inside; `'overlapping'` also includes cells that touch the polygon, for gap-free coverage. Defaults to `'center'`.

#### Return value

- **(BigUint64Array)** Compacted cells belonging to the polygon sorted in curve order, then the compaction marker. A polygon with no cells gives just the compaction marker

#### Example

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

### lineStringToCells

Returns all cells whose pentagons intersect a polyline defined by a sequence of waypoints. Consecutive waypoints are connected with great-circle arcs. For a simple two-point line segment, pass `[start, end]`.

The result is uncompacted at the requested resolution and is not sorted — cells appear roughly in the order they were discovered along the path. Cells at waypoint junctions are deduplicated.

```ts
function lineStringToCells(waypoints: LonLat[], resolution: number): bigint[];
```

#### Parameters

- `waypoints` **(LonLat[])** Polyline vertices, each as `[longitude, latitude]`
- `resolution` **(number)** Target resolution (0–30)

#### Return value

- **(bigint[])** Array of unique cell identifiers whose pentagons intersect the polyline

#### Example

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

## Cell representation

A5 cells are stored as 64 bit integers, for performance and to provide a compact representation for use in databases. In JavaScript these can be represented as [BigInt](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt) values and arrays of cells stored as [BigInt64Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt64Array)s.

For best performance it is recommened to use this representation, but it is also possible to convert them into hexidecimal, for example to encode them in JSON (which does _not_ support 64 bit integers). Two helper functions are provided for this conversion.

### u64ToHex

```ts
function u64ToHex(index: bigint): string;
```

#### Parameters

- `index` **(bigint)** A5 cell identifier

#### Return value

- **(string)** Hexadecimal string representation of the cell identifier

### hexToU64

```ts
function hexToU64(hex: string): bigint;
```

#### Parameters

- `hex` **(string)** Hexadecimal string representation of an A5 cell identifier

#### Return value

- **(bigint)** The A5 cell identifier
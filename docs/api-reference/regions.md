# Regions

Functions for converting between cells and polygonal regions on the sphere.

By default, cell membership uses **center-point containment**: a cell belongs to a polygon if and only if its center lies inside the polygon. This guarantees non-overlapping coverage when neighboring polygons share an edge. The `containment` option lets you switch to **overlapping** coverage instead, where every cell that touches the polygon is included — useful when you need a covering with no gaps along the boundary.

### polygonToCells

Returns all cells within a polygon, defined either by a single ring of `[longitude, latitude]` vertices or by GeoJSON-style rings `[outer, ...holes]`. Cells inside a hole are excluded.

Rings may be open or closed (GeoJSON-style, with the first vertex repeated at the end) — closure is automatic either way. Either winding order is accepted; the orientation is detected from the ring geometry. Hole rings with fewer than 3 distinct vertices are ignored.

The `containment` option controls which cells count as belonging to the polygon:

- `'center'` (default) — a cell is included only if its center lies inside the polygon. Adjacent polygons that share an edge produce disjoint coverings, so this is the right choice for partitioning.
- `'overlapping'` — additionally includes every cell that overlaps the polygon boundary. The result is a superset of `'center'` that fully covers the polygon with no gaps, at the cost of some overlap with adjacent polygons. Use this when a query must not miss any cell touching the region (for example, filtering database rows by cell before applying an exact geometry test).

The result is compacted — use [`uncompact`](compaction#uncompact) to expand to the input resolution. The compacted form is intended for storage, transfer and set operations: cell boundaries of different resolutions do not nest geometrically, so a mixed-resolution covering will show overlaps and gaps when rendered. Uncompact to a single resolution before drawing cells on a map.

Multi-polygons are not supported directly — call `polygonToCells` per polygon and concatenate the results (with `'center'` containment, coverings of disjoint polygons never overlap).

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

- **(BigUint64Array)** Sorted, compacted array of cell identifiers belonging to the polygon

#### Example

```ts
import { polygonToCells, uncompact, getResolution } from 'a5-js';

// Bounding box around central Paris
const ring = [
  [2.25, 48.81],
  [2.42, 48.81],
  [2.42, 48.90],
  [2.25, 48.90]
];
const compact = polygonToCells(ring, 10);
const flat = uncompact(compact, 10);

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

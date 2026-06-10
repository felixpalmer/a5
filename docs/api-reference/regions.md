# Regions

Functions for converting between cells and polygonal regions on the sphere.

Cell membership uses **center-point containment**: a cell belongs to a polygon if and only if its center lies inside the polygon. This guarantees non-overlapping coverage when neighboring polygons share an edge.

### polygonToCells

Returns all cells whose centers lie inside a polygon, defined either by a single ring of `[longitude, latitude]` vertices or by GeoJSON-style rings `[outer, ...holes]`. Cells whose centers fall inside a hole are excluded.

Rings may be open or closed (GeoJSON-style, with the first vertex repeated at the end) — closure is automatic either way. Either winding order is accepted; the orientation is detected from the ring geometry. Hole rings with fewer than 3 distinct vertices are ignored.

The result is compacted — use [`uncompact`](compaction#uncompact) to expand to the input resolution. The compacted form is intended for storage, transfer and set operations: cell boundaries of different resolutions do not nest geometrically, so a mixed-resolution covering will show overlaps and gaps when rendered. Uncompact to a single resolution before drawing cells on a map.

Multi-polygons are not supported directly — call `polygonToCells` per polygon and concatenate the results (coverings of disjoint polygons never overlap).

```ts
function polygonToCells(polygon: LonLat[] | LonLat[][], resolution: number): BigUint64Array;
```

#### Parameters

- `polygon` **(LonLat[] | LonLat[][])** Either a single ring of `[longitude, latitude]` vertices, or an array of rings where the first ring is the outer boundary and subsequent rings are holes. The outer ring must contain at least 3 vertices.
- `resolution` **(number)** Target resolution (0–30)

#### Return value

- **(BigUint64Array)** Sorted, compacted array of cell identifiers whose centers fall inside the polygon

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
```

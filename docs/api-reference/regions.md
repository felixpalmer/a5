# Regions

Functions for converting between cells and polygonal regions on the sphere.

Cell membership uses **center-point containment**: a cell belongs to a polygon if and only if its center lies inside the polygon. This guarantees non-overlapping coverage when neighboring polygons share an edge.

### polygonToCells

Returns all cells whose centers lie inside a polygon defined by a single ring of `[longitude, latitude]` vertices.

The ring is closed automatically — do not repeat the first vertex at the end. Either winding order is accepted; the orientation is detected from the ring geometry.

The result is compacted — use [`uncompact`](compaction#uncompact) to expand to the input resolution. Holes and multi-polygons are not supported — pass a single outer ring. To fill a polygon with holes, take the set difference between the outer ring's cells and each hole's cells.

```ts
function polygonToCells(ring: LonLat[], resolution: number): BigUint64Array;
```

#### Parameters

- `ring` **(LonLat[])** Polygon vertices, each as `[longitude, latitude]`. Must contain at least 3 vertices.
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
```

// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type {LonLat, Cartesian} from '../core/coordinate-systems';
import {cellToSpherical} from '../core/cell';
import {fromLonLat, toCartesian} from '../core/coordinate-transforms';
import {
  cellToChildren,
  getResolution,
  FIRST_HILBERT_RESOLUTION,
  MAX_RESOLUTION,
  WORLD_CELL
} from '../core/serialization';
import {compact} from '../core/compact';
import {preparePolygon, pointInPreparedPolygon} from '../geometry/prepared-polygon';
import {cellIdsToTriples} from '../traversal/triple-cells';
import {boundaryOutput, classifyBoundary, sampleBoundary} from './polygon-boundary';
import {fillByCurveRuns} from './curve-runs';
import {fillByFlood, prefersFlood} from './interior-flood';

/**
 * How a cell is judged to belong to the polygon.
 * - `'center'`: a cell is included iff its center lies inside the polygon.
 * - `'overlapping'`: additionally include every cell that overlaps the polygon
 *   boundary, giving gap-free coverage (a superset of `'center'`).
 */
export type PolygonContainment = 'center' | 'overlapping';

type PolygonToCellsOptions = {
  /**
   * Which cells to include relative to the polygon.
   * @default 'center'
   */
  containment?: PolygonContainment;
};

/**
 * Find all cells within a polygon. The result is compacted — use `uncompact`
 * to expand to the input resolution.
 *
 * @param polygon - Either a single ring of [longitude, latitude] vertices, or
 *   GeoJSON-style rings `[outer, ...holes]` where cells inside a hole are
 *   excluded. Rings may be open or closed (GeoJSON-style, first vertex
 *   repeated at the end) — closure is automatic either way. Holes with fewer
 *   than 3 distinct vertices are ignored.
 * @param resolution - Target resolution (0..30)
 * @param options - `containment` selects `'center'` (default, cell center
 *   inside the polygon) or `'overlapping'` (any cell touching the polygon, for
 *   gap-free coverage).
 * @returns Sorted, compacted BigUint64Array of cell IDs
 */
export function polygonToCells(
  polygon: LonLat[] | LonLat[][],
  resolution: number,
  {containment = 'center'}: PolygonToCellsOptions = {}
): BigUint64Array {
  // Normalize: a flat ring is shorthand for a polygon with no holes.
  const isNested = polygon.length > 0 && typeof (polygon[0] as LonLat | LonLat[])[0] !== 'number';
  const inputRings = (isNested ? polygon : [polygon]) as LonLat[][];

  // GeoJSON rings repeat the first vertex at the end — drop the duplicate.
  const stripClosing = (ring: LonLat[]): LonLat[] => {
    const last = ring.length - 1;
    return last > 0 && ring[0][0] === ring[last][0] && ring[0][1] === ring[last][1] ? ring.slice(0, -1) : ring;
  };

  if (inputRings.length === 0) return new BigUint64Array(0);
  const outer = stripClosing(inputRings[0]);
  if (outer.length < 3) return new BigUint64Array(0);
  const rings: LonLat[][] = [outer];
  for (let r = 1; r < inputRings.length; r++) {
    const hole = stripClosing(inputRings[r]);
    if (hole.length >= 3) rings.push(hole);
  }

  // Authalic-sphere ring vectors — A5's internal sphere, so cell centers
  // compare directly with no geodetic↔authalic round-trip.
  const ringVecsList: Cartesian[][] = new Array(rings.length);
  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    const ringVecs: Cartesian[] = new Array(ring.length);
    for (let i = 0; i < ring.length; i++) {
      ringVecs[i] = toCartesian(fromLonLat(ring[i]));
    }
    ringVecsList[r] = ringVecs;
  }

  const prep = preparePolygon(ringVecsList);
  const sampled = sampleBoundary(rings, ringVecsList, resolution);

  // Res 30 covers only quintants 0-41 (elsewhere A5 answers at res 29, see
  // serialize), so a polygon reaching past them is filled at res 29: mixing the
  // two lattices would leave the fill without a consistent grid.
  if (resolution === MAX_RESOLUTION && sampled.cells.some(cell => getResolution(cell) !== resolution)) {
    return polygonToCells(polygon, resolution - 1, {containment});
  }

  const boundary = classifyBoundary(sampled, ringVecsList, prep);
  const overlapping = containment === 'overlapping';

  // Resolutions 0 and 1 have no lattice (a quintant is a single cell): every
  // cell off the boundary is in or out by its center, and there are at most 60
  // of them.
  if (resolution < FIRST_HILBERT_RESOLUTION) {
    const out = boundaryOutput(boundary, overlapping);
    for (const cell of cellToChildren(WORLD_CELL, resolution)) {
      if (!boundary.set.has(cell) && pointInPreparedPolygon(toCartesian(cellToSpherical(cell)), prep)) out.push(cell);
    }
    return compact(out);
  }

  // A quintant holding no boundary cells is wholly inside or outside; it can
  // only be inside when the polygon's bounding cap holds a quintant's area (4π/60)
  const capHoldsQuintant = 2 * Math.PI * (1 - prep.cap.minDot) >= (4 * Math.PI) / 60;
  const triples = cellIdsToTriples(boundary.cells);
  return prefersFlood(ringVecsList, boundary.cells.length, resolution, capHoldsQuintant)
    ? fillByFlood(boundary, triples, resolution, overlapping)
    : fillByCurveRuns(boundary, triples, resolution, overlapping, capHoldsQuintant);
}

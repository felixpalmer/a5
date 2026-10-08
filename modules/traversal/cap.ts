// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type {Spherical} from '../core/coordinate-systems';
import type {OriginId} from '../core/utils';
import {getResolution, cellToParent, deserialize, serialize, FIRST_HILBERT_RESOLUTION} from '../core/serialization';
import {cellToSpherical} from '../core/cell';
import {cellArea} from '../core/cell-info';
import {slotRunsToCovering, toCovering} from '../collections/slot-runs';
import type {SlotRuns} from '../collections/types';
import {AUTHALIC_RADIUS_EARTH} from '../core/constants';
import {walkFaces} from '../core/face-adjacency';
import {haversine, origins} from '../core/origin';
import {DodecahedronProjection} from '../projections/dodecahedron';
import {descendInCurveOrder, INSIDE, OUTSIDE, SPLIT} from './curve-descent';
import {cellIdsToTriples, tripleCellCenter, walkTripleCells} from './triple-cells';

const dodecahedron = new DodecahedronProjection();

/** Safety factor applied to equal-area circle radius to get conservative circumradius estimate */
const CELL_RADIUS_SAFETY_FACTOR = 2.0;

/** Minimum cells in the cap before hierarchical subdivision is worthwhile */
const MIN_CELLS_FOR_SUBDIVISION = 20;

/**
 * Convert a distance in meters to a haversine threshold value.
 * Since haversine h = sin²(d/2R) is monotonic in d for d ∈ [0, πR],
 * comparing h ≤ threshold is equivalent to comparing dist ≤ radius
 * but avoids the asin/sqrt per point.
 */
export function metersToH(meters: number): number {
  const s = Math.sin(meters / (2 * AUTHALIC_RADIUS_EARTH));
  return s * s;
}

/**
 * Estimate a conservative cell circumradius in meters for a given resolution.
 *
 * Derived from: cellRadius = SAFETY * sqrt(cellArea / π)
 *             = SAFETY * sqrt(4πR² / (numCells × π))
 *             = SAFETY × 2R / sqrt(numCells)
 *
 * For r ≥ 1: numCells = 60 × 4^(r-1), so sqrt(numCells) = 2√15 × 2^(r-1)
 * giving: cellRadius(r) = BASE_CELL_RADIUS / 2^(r-1)
 * i.e. the radius exactly halves at each resolution level.
 */
const BASE_CELL_RADIUS = (CELL_RADIUS_SAFETY_FACTOR * AUTHALIC_RADIUS_EARTH) / Math.sqrt(15);
const _cellRadius: number[] = new Array(31);
_cellRadius[0] = (CELL_RADIUS_SAFETY_FACTOR * AUTHALIC_RADIUS_EARTH) / Math.sqrt(3);
for (let r = 1; r <= 30; r++) {
  _cellRadius[r] = BASE_CELL_RADIUS / (1 << (r - 1));
}

export function estimateCellRadius(resolution: number): number {
  return _cellRadius[resolution];
}

/**
 * Pick the coarsest resolution where the cap contains enough cells
 * to make hierarchical subdivision worthwhile.
 */
export function pickCoarseResolution(radius: number, targetRes: number): number {
  // Spherical cap area in m²: 2πR²(1 − cos(r/R)) computed as 4πR²·sin²(r/2R),
  // which keeps full precision for small radii where 1 − cos cancels
  const halfAngleSin = Math.sin(radius / (2 * AUTHALIC_RADIUS_EARTH));
  const capAreaM2 = 4 * Math.PI * AUTHALIC_RADIUS_EARTH * AUTHALIC_RADIUS_EARTH * halfAngleSin * halfAngleSin;

  for (let res = FIRST_HILBERT_RESOLUTION; res <= targetRes; res++) {
    const cArea = cellArea(res);
    if (capAreaM2 / cArea >= MIN_CELLS_FOR_SUBDIVISION) {
      return res;
    }
  }
  return targetRes; // No coarsening benefit
}

/**
 * BFS at the cap's coarse resolution (1 or above) from `startCell` through every
 * cell whose center lies within `hExpanded` of `center`, returning those cells
 * (the ring just outside lies beyond every threshold the descent applies).
 *
 * Runs in triple space (cells as flat (originId, quintant, x, y, z)): neighbors
 * (edge and vertex) come from the per-flavor triple deltas plus the boundary
 * delta tables, and a cell's center straight from its triple.
 */
function coarseCapCells(startCell: bigint, center: Spherical, hExpanded: number): number[] {
  const hilbertRes = getResolution(startCell) - FIRST_HILBERT_RESOLUTION + 1;
  const maxRow = (1 << hilbertRes) - 1;
  const cells = cellIdsToTriples([startCell]);
  walkTripleCells(cells.slice(), maxRow, (originId, q, x, y, z) => {
    const within = haversine(center, tripleCellCenter(originId, q, x, y, z, hilbertRes, maxRow)) <= hExpanded;
    if (within) cells.push(originId, q, x, y, z);
    return within;
  });
  return cells;
}

/**
 * Compute all cells within a great-circle radius, returning a compacted result
 * (mix of resolutions), with a compaction marker recording the resolution.
 *
 * Descends the hierarchy (see curve-descent): starts at a coarse resolution and
 * subdivides boundary cells, keeping interior cells at coarser resolutions.
 * Only cells whose centers fall within the radius are included.
 *
 * Distance comparisons use the haversine intermediate value h = sin²(d/2R)
 * directly, avoiding the expensive asin/sqrt per cell. Pre-computed h
 * thresholds replace km-based distance checks.
 *
 * To get all cells at the target resolution, chain with `uncompact`:
 * ```ts
 * const flat = uncompact(sphericalCap(cellId, 50_000));
 * ```
 *
 * @param cellId - Center cell ID (bigint)
 * @param radius - Radius in meters
 * @returns Compacted cells sorted in curve order, then the compaction marker
 */
export function sphericalCap(cellId: bigint, radius: number): BigUint64Array {
  const targetRes = getResolution(cellId);
  const coarseRes = pickCoarseResolution(radius, targetRes);
  const center = cellToSpherical(cellId);

  // Pre-compute haversine thresholds: the exact radius, and the radius expanded
  // so the coarse BFS captures every overlapping cell
  const hRadius = metersToH(radius);
  const hExpanded = metersToH(radius + estimateCellRadius(coarseRes));
  const startCell = coarseRes < targetRes ? cellToParent(cellId, coarseRes) : cellId;

  if (coarseRes === 0) {
    // The target is resolution 0: the cells are the 12 dodecahedron faces
    const result: bigint[] = [];
    const faceCell = (face: OriginId) => serialize({origin: origins[face], segment: 0, S: 0n, resolution: 0});
    const near = (face: OriginId, h: number) => haversine(center, cellToSpherical(faceCell(face))) <= h;
    for (const face of walkFaces([deserialize(startCell).origin.id], face => near(face, hExpanded))) {
      if (near(face, hRadius)) result.push(faceCell(face));
    }
    return toCovering(result, targetRes);
  }

  // Descend from the coarse cells to targetRes, classifying each cell by
  // comparing haversine(center, cell) against pre-computed h thresholds:
  // - Interior (h ≤ hInner): keep whole, all descendants inside
  // - Outside  (h > hOuter): discard, no descendants inside
  // - Boundary: split into children
  // At the target resolution both thresholds are the exact radius.
  const hInner: number[] = [];
  const hOuter: number[] = [];
  for (let res = coarseRes; res <= targetRes; res++) {
    const cellRadius = estimateCellRadius(res);
    const last = res === targetRes;
    hInner[res] = last ? hRadius : radius > cellRadius ? metersToH(radius - cellRadius) : -1;
    hOuter[res] = last ? hRadius : metersToH(radius + cellRadius);
  }
  const runs: SlotRuns = [];
  descendInCurveOrder(
    coarseCapCells(startCell, center, hExpanded),
    coarseRes - FIRST_HILBERT_RESOLUTION + 1,
    targetRes,
    (originId, res, face) => {
      const h = haversine(center, dodecahedron.inverse(face, originId));
      return h <= hInner[res] ? INSIDE : h <= hOuter[res] ? SPLIT : OUTSIDE;
    },
    runs
  );
  return slotRunsToCovering(runs, targetRes);
}

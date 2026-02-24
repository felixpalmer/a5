// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { getResolution, cellToParent, cellToChildren, FIRST_HILBERT_RESOLUTION } from '../core/serialization';
import { cellToSpherical } from '../core/cell';
import { cellArea } from '../core/cell-info';
import { AUTHALIC_RADIUS_EARTH } from '../core/constants';
import { getGlobalCellNeighbors } from './global-neighbors';
import { haversine } from '../core/origin';

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
const BASE_CELL_RADIUS = CELL_RADIUS_SAFETY_FACTOR * AUTHALIC_RADIUS_EARTH / Math.sqrt(15);
const _cellRadius: number[] = new Array(31);
_cellRadius[0] = CELL_RADIUS_SAFETY_FACTOR * AUTHALIC_RADIUS_EARTH / Math.sqrt(3);
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
  // Spherical cap area in m²
  const capAreaM2 = 2 * Math.PI * AUTHALIC_RADIUS_EARTH * AUTHALIC_RADIUS_EARTH *
    (1 - Math.cos(radius / AUTHALIC_RADIUS_EARTH));

  for (let res = FIRST_HILBERT_RESOLUTION; res <= targetRes; res++) {
    const cArea = cellArea(res);
    if (capAreaM2 / cArea >= MIN_CELLS_FOR_SUBDIVISION) {
      return res;
    }
  }
  return targetRes; // No coarsening benefit
}

/**
 * Compute all cells within a great-circle radius, returning a naturally
 * compacted result (mix of resolutions) as a BigUint64Array.
 *
 * Uses hierarchical BFS: starts at a coarse resolution and recursively
 * subdivides boundary cells, keeping interior cells at coarser resolutions.
 * Only cells whose centers fall within the radius are included.
 *
 * Distance comparisons use the haversine intermediate value h = sin²(d/2R)
 * directly, avoiding the expensive asin/sqrt per cell. Pre-computed h
 * thresholds replace km-based distance checks.
 *
 * To get all cells at the target resolution, chain with `uncompact`:
 * ```ts
 * const flat = uncompact(sphericalCap(cellId, 50_000), getResolution(cellId));
 * ```
 *
 * @param cellId - Center cell ID (bigint)
 * @param radius - Radius in meters
 * @returns Sorted BigUint64Array of cell IDs at mixed resolutions (compacted)
 */
export function sphericalCap(
  cellId: bigint, radius: number
): BigUint64Array {
  const targetRes = getResolution(cellId);
  const coarseRes = pickCoarseResolution(radius, targetRes);
  const center = cellToSpherical(cellId);

  // Pre-compute haversine threshold for the exact radius
  const hRadius = metersToH(radius);

  // BFS at coarse resolution with expanded radius to capture all overlapping cells.
  const startCell = coarseRes < targetRes ? cellToParent(cellId, coarseRes) : cellId;
  const coarseCellRadius = estimateCellRadius(coarseRes);
  const hExpanded = metersToH(radius + coarseCellRadius);
  const coarseVisited = new Set<bigint>([startCell]);
  let coarseFrontier = new Set<bigint>([startCell]);

  while (coarseFrontier.size > 0) {
    const nextFrontier = new Set<bigint>();
    for (const id of coarseFrontier) {
      for (const neighbor of getGlobalCellNeighbors(id)) {
        if (coarseVisited.has(neighbor)) continue;
        coarseVisited.add(neighbor);
        if (haversine(center, cellToSpherical(neighbor)) <= hExpanded) {
          nextFrontier.add(neighbor);
        }
      }
    }
    coarseFrontier = nextFrontier;
  }

  // Recursive subdivision from coarseRes to targetRes.
  //
  // Each cell is classified by comparing haversine(center, cell) against
  // pre-computed h thresholds:
  // - Interior (h ≤ hInner): keep compacted, all descendants inside
  // - Outside  (h > hOuter): discard, no descendants inside
  // - Boundary: subdivide children to next level
  const result: bigint[] = [];
  let boundary = Array.from(coarseVisited);

  for (let res = coarseRes; res < targetRes; res++) {
    const cellRadius = estimateCellRadius(res);
    const hInner = radius > cellRadius ? metersToH(radius - cellRadius) : -1;
    const hOuter = metersToH(radius + cellRadius);
    const nextBoundary: bigint[] = [];

    for (const cell of boundary) {
      const h = haversine(center, cellToSpherical(cell));
      if (h <= hInner) {
        result.push(cell);
      } else if (h > hOuter) {
        // Cell's entire extent is outside the cap — discard
      } else {
        for (const child of cellToChildren(cell, res + 1)) {
          nextBoundary.push(child);
        }
      }
    }

    boundary = nextBoundary;
  }

  // Final target resolution: strict haversine check
  for (const cell of boundary) {
    if (haversine(center, cellToSpherical(cell)) <= hRadius) {
      result.push(cell);
    }
  }

  const out = BigUint64Array.from(result);
  out.sort();
  return out;
}

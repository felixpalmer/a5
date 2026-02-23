// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type { Anchor, Orientation, Triple } from '../lattice';
import { sToAnchor, anchorToTriple, tripleToAnchor, tripleToS, tripleInBounds } from '../lattice';
import { compareBigint } from '../utils/bigint';
import { isNeighbor } from './neighbors';

/**
 * Find within-quintant neighbors via triple coordinate search.
 *
 * Generates ±1 candidate triples, validates with isNeighbor() in uv space,
 * and converts validated triples to s-values in the requested orientation.
 *
 * @param sourceTriple - Triple coordinates of the source cell
 * @param uvSourceAnchor - Source anchor in uv orientation (for isNeighbor validation)
 * @param sourceS - Source s-value to exclude from results
 * @param resolution - Resolution level
 * @param orientation - Hilbert curve orientation
 * @param edgeOnly - If true, only edge-sharing neighbors (Manhattan distance ≤ 2)
 * @returns Array of neighbor s-values (unsorted)
 */
export function findQuintantNeighborS(
  sourceTriple: Triple,
  uvSourceAnchor: Anchor | null,
  sourceS: bigint,
  resolution: number,
  orientation: Orientation,
  edgeOnly: boolean
): bigint[] {
  const maxS = 4n ** BigInt(resolution);
  const maxRow = (1 << resolution) - 1;
  const neighbors: bigint[] = [];

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dy === 0 && dz === 0) continue;
        if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 3) continue;
        if (edgeOnly && Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 2) continue;

        const neighborTriple: Triple = {x: sourceTriple.x + dx, y: sourceTriple.y + dy, z: sourceTriple.z + dz};
        if (!tripleInBounds(neighborTriple, maxRow)) continue;

        // Validate in uv space where isNeighbor is known to work
        const uvNeighborAnchor = tripleToAnchor(neighborTriple, resolution, 'uv');
        if (!uvNeighborAnchor || !uvSourceAnchor) continue;
        if (!isNeighbor(uvSourceAnchor, uvNeighborAnchor)) continue;

        const neighborS = tripleToS(neighborTriple, resolution, orientation);
        if (neighborS !== null && neighborS >= 0n && neighborS < maxS && neighborS !== sourceS) {
          neighbors.push(neighborS);
        }
      }
    }
  }

  return neighbors;
}

/**
 * Fast neighbor finding using triple coordinates.
 *
 * Strategy:
 * 1. Convert cell to triple coordinates (x, y, z) — orientation-independent
 * 2. Generate neighbor triples (Manhattan distance ≤ 3) — ~12 candidates
 * 3. Validate with isNeighbor() in 'uv' space (NEIGHBORS patterns are defined in uv/raw IJ space)
 * 4. Convert validated triples to s-values in the requested orientation
 *
 * Key insight: Triple coordinates are orientation-independent — the same geometric cell
 * always has the same triple coords regardless of Hilbert curve orientation. Only the
 * s-value (Hilbert index) changes between orientations. This means neighbor finding
 * can be done entirely in triple/uv space, then results converted to any orientation.
 *
 * @param s - Cell s-value (Hilbert index)
 * @param resolution - Resolution level
 * @param orientation - Hilbert curve orientation (default: 'uv')
 * @param options.edgeOnly - If true, return only edge-sharing neighbors (Manhattan distance ≤ 2).
 *   Default false returns all neighbors including vertex-only (Manhattan distance 3).
 * @returns Array of neighbor s-values
 */
export function getCellNeighbors(
  s: bigint,
  resolution: number,
  orientation: Orientation = 'uv',
  options?: {edgeOnly?: boolean}
): bigint[] {
  const anchor = sToAnchor(s, resolution, orientation);
  const triple = anchorToTriple(anchor);
  const uvSourceAnchor = tripleToAnchor(triple, resolution, 'uv');

  return findQuintantNeighborS(
    triple, uvSourceAnchor, s, resolution, orientation, options?.edgeOnly ?? false
  ).sort(compareBigint);
}

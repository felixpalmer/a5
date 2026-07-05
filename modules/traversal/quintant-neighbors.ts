// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type {Orientation, Triple} from '../lattice';
import {sToCell, tripleToS, tripleInBounds} from '../lattice';
import {compareBigint} from '../utils/bigint';
import {NEIGHBOR_DELTAS} from './neighbors';

/**
 * Find within-quintant neighbors via the cell's pentagon flavor.
 *
 * A cell's neighbors sit at fixed triple deltas determined by its flavor
 * (NEIGHBOR_DELTAS — 5 edge-sharing + 2 vertex-only), so no per-candidate
 * validation is needed: each in-bounds delta is a neighbor.
 *
 * @param sourceTriple - Triple coordinates of the source cell
 * @param sourceFlavor - Pentagon flavor of the source cell (0-3)
 * @param sourceS - Source s-value to exclude from results
 * @param resolution - Resolution level
 * @param orientation - Curve orientation
 * @param edgeOnly - If true, only the 5 edge-sharing neighbors
 * @returns Array of neighbor s-values (unsorted)
 */
export function findQuintantNeighborS(
  sourceTriple: Triple,
  sourceFlavor: number,
  sourceS: bigint,
  resolution: number,
  orientation: Orientation,
  edgeOnly: boolean
): bigint[] {
  const maxS = 4n ** BigInt(resolution);
  const maxRow = (1 << resolution) - 1;
  const deltas = NEIGHBOR_DELTAS[sourceFlavor];
  const neighbors: bigint[] = [];

  const collect = (list: readonly Triple[]): void => {
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      const neighborTriple: Triple = {x: sourceTriple.x + d.x, y: sourceTriple.y + d.y, z: sourceTriple.z + d.z};
      if (!tripleInBounds(neighborTriple, maxRow)) continue;
      const neighborS = tripleToS(neighborTriple, resolution, orientation);
      if (neighborS !== null && neighborS >= 0n && neighborS < maxS && neighborS !== sourceS) {
        neighbors.push(neighborS);
      }
    }
  };
  collect(deltas.edge);
  if (!edgeOnly) collect(deltas.vertex);

  return neighbors;
}

/**
 * Neighbor finding via triple coordinates and pentagon flavor.
 *
 * Triple coordinates are orientation-independent — the same geometric cell
 * always has the same triple coords regardless of curve orientation. Only the
 * s-value changes between orientations, so neighbors are found in triple
 * space and converted back to the requested orientation.
 *
 * @param s - Cell s-value (curve index)
 * @param resolution - Resolution level
 * @param orientation - Curve orientation (default: 'uv')
 * @param options.edgeOnly - If true, return only the 5 edge-sharing neighbors.
 *   Default false also returns the 2 vertex-only neighbors.
 * @returns Array of neighbor s-values
 */
export function getCellNeighbors(
  s: bigint,
  resolution: number,
  orientation: Orientation = 'uv',
  options?: {edgeOnly?: boolean}
): bigint[] {
  const {triple, flavor} = sToCell(s, resolution, orientation);
  return findQuintantNeighborS(triple, flavor, s, resolution, orientation, options?.edgeOnly ?? false).sort(
    compareBigint
  );
}

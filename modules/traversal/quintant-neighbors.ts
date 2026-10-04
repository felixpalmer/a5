// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type {Orientation, Triple} from '../lattice';
import {sToCell, tripleToS, tripleInBounds} from '../lattice';
import {compareBigint} from '../utils/bigint';
import {NEIGHBOR_DELTAS} from './neighbors';

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
  const maxRow = (1 << resolution) - 1;
  const deltas = options?.edgeOnly ? NEIGHBOR_DELTAS[flavor].edge : NEIGHBOR_DELTAS[flavor].all;
  const neighbors: bigint[] = [];
  for (let i = 0; i < deltas.length; i++) {
    const d = deltas[i];
    const neighbor: Triple = {x: triple.x + d.x, y: triple.y + d.y, z: triple.z + d.z};
    if (tripleInBounds(neighbor, maxRow)) neighbors.push(tripleToS(neighbor, resolution, orientation)!);
  }
  return neighbors.sort(compareBigint);
}

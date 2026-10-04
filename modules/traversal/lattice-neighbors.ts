// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {getResolution, FIRST_HILBERT_RESOLUTION} from '../core/serialization';
import {getGlobalCellNeighbors} from './global-neighbors';
import {cellIdsToTriples, forEachLatticeNeighbor, tripleCellToId} from './triple-cells';

/**
 * Fast lattice-based neighbor finding over triple-space deltas: the 3
 * parity-valid moves — strict triple-lattice edge connectivity, the
 * connectivity `tripleSpaceFloodFill` uses — plus the edge-sharing neighbors
 * across a quintant edge (see `forEachLatticeNeighbor`). Falls back to
 * `getGlobalCellNeighbors` below res 2.
 */
export function getLatticeNeighbors(cellId: bigint): bigint[] {
  const resolution = getResolution(cellId);
  if (resolution < FIRST_HILBERT_RESOLUTION) return getGlobalCellNeighbors(cellId, {edgeOnly: true});

  const hilbertRes = resolution - FIRST_HILBERT_RESOLUTION + 1;
  const [originId, quintant, x, y, z] = cellIdsToTriples([cellId]);
  const result: bigint[] = [];
  forEachLatticeNeighbor(originId, quintant, x, y, z, (1 << hilbertRes) - 1, (o, q, nx, ny, nz) => {
    result.push(tripleCellToId(o, q, nx, ny, nz, hilbertRes, resolution));
  });
  return result;
}

// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {deserialize, getResolution, serialize, FIRST_HILBERT_RESOLUTION} from '../core/serialization';
import {origins} from '../core/origin';
import {FACE_ADJACENCY} from '../core/face-adjacency';
import {compareBigint} from '../utils/bigint';
import {cellIdsToTriples, forEachTripleNeighbor, tripleCellToId} from './triple-cells';

/**
 * Get all neighbors of a cell across quintant and face boundaries: within its
 * quintant the fixed per-flavor triple deltas, and across a quintant edge the
 * boundary delta tables (see `forEachTripleNeighbor`).
 *
 * @param options.edgeOnly - If true, return only edge-sharing neighbors (5 per cell).
 *   Default false returns all neighbors including vertex-only neighbors (6-8 per cell).
 */
export function getGlobalCellNeighbors(cellId: bigint, options?: {edgeOnly?: boolean}): bigint[] {
  const resolution = getResolution(cellId);
  const neighbors = new Set<bigint>();
  if (resolution === 0) {
    // The cells are the 12 dodecahedron faces, adjacent across their edges
    for (const [face] of FACE_ADJACENCY[deserialize(cellId).origin.id]) {
      neighbors.add(serialize({origin: origins[face], segment: 0, S: 0n, resolution: 0}));
    }
  } else {
    const hilbertRes = resolution - FIRST_HILBERT_RESOLUTION + 1;
    const [originId, quintant, x, y, z] = cellIdsToTriples([cellId]);
    const maxRow = (1 << hilbertRes) - 1;
    const edgeOnly = options?.edgeOnly ?? false;
    forEachTripleNeighbor(originId, quintant, x, y, z, maxRow, edgeOnly, (o, q, nx, ny, nz) => {
      neighbors.add(tripleCellToId(o, q, nx, ny, nz, hilbertRes, resolution));
    });
  }
  return Array.from(neighbors).sort(compareBigint);
}

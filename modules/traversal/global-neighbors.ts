// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {sToCell, tripleParity} from '../lattice';
import type {Origin} from '../core/utils';
import {deserialize, serialize, FIRST_HILBERT_RESOLUTION} from '../core/serialization';
import {segmentToQuintant, origins} from '../core/origin';
import {FACE_ADJACENCY} from '../core/face-adjacency';
import {compareBigint} from '../utils/bigint';
import {findQuintantNeighborS} from './quintant-neighbors';
import {getBoundaryNeighbors} from './lattice-boundary';

/**
 * Get neighbors of a resolution 0 cell (dodecahedron face).
 */
function getRes0Neighbors(origin: Origin): bigint[] {
  const neighborSet = new Set<bigint>();
  for (let q = 0; q < 5; q++) {
    const [adjacentFaceId] = FACE_ADJACENCY[origin.id][q];
    neighborSet.add(serialize({origin: origins[adjacentFaceId], segment: 0, S: 0n, resolution: 0}));
  }
  return Array.from(neighborSet).sort(compareBigint);
}

/**
 * Get all neighbors of a cell across quintant and face boundaries.
 *
 * Within-quintant neighbors come from the fixed per-flavor triple deltas
 * (via `findQuintantNeighborS`). Cross-quintant, cross-face, apex, and
 * corner neighbors are emitted by the shared `forEachBoundaryNeighbor`
 * helper using fixed delta tables — see `lattice-boundary.ts`.
 *
 * @param options.edgeOnly - If true, return only edge-sharing neighbors (5 per cell).
 *   Default false returns all neighbors including vertex-only neighbors (6-8 per cell).
 */
export function getGlobalCellNeighbors(cellId: bigint, options?: {edgeOnly?: boolean}): bigint[] {
  const {origin, segment, S, resolution} = deserialize(cellId);
  const edgeOnly = options?.edgeOnly ?? false;
  if (resolution === 0) return getRes0Neighbors(origin);

  const hilbertRes = resolution - FIRST_HILBERT_RESOLUTION + 1;
  const {quintant: sourceQuintant, orientation: sourceOrientation} = segmentToQuintant(segment, origin);

  // Triple coordinates are orientation-independent
  const {triple, flavor} = sToCell(S, hilbertRes, sourceOrientation);

  const neighborSet = new Set<bigint>();

  // --- Within-quintant: fixed per-flavor triple deltas ---
  for (const neighborS of findQuintantNeighborS(triple, flavor, S, hilbertRes, sourceOrientation, edgeOnly)) {
    neighborSet.add(serialize({origin, segment, S: neighborS, resolution}));
  }

  // --- Cross-quintant / cross-face / apex / corner: shared lattice-boundary helper ---
  const boundaryNeighbors = getBoundaryNeighbors(
    {
      triple,
      parity: tripleParity(triple),
      sourceQuintant,
      origin,
      hilbertRes,
      maxS: 4n ** BigInt(hilbertRes),
      maxRow: (1 << hilbertRes) - 1,
      resolution
    },
    edgeOnly
  );
  for (const cellId of boundaryNeighbors) neighborSet.add(cellId);

  return Array.from(neighborSet).sort(compareBigint);
}

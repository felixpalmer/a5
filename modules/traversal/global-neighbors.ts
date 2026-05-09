// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {sToAnchor, anchorToTriple, tripleToAnchor, tripleParity} from '../lattice';
import type {Origin} from '../core/utils';
import {deserialize, serialize, FIRST_HILBERT_RESOLUTION} from '../core/serialization';
import {segmentToQuintant, quintantToSegment, origins} from '../core/origin';
import {FACE_ADJACENCY} from '../core/face-adjacency';
import {compareBigint} from '../utils/bigint';
import {findQuintantNeighborS} from './quintant-neighbors';
import {getBoundaryNeighbors} from './lattice-boundary';

/** Serialize a res 1 cell from origin and quintant. */
function serializeRes1(origin: Origin, quintant: number): bigint {
  const {segment} = quintantToSegment(quintant, origin);
  return serialize({origin, segment, S: 0n, resolution: 1});
}

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
 * Get neighbors of a resolution 1 cell (quintant).
 */
function getRes1Neighbors(origin: Origin, segment: number, edgeOnly: boolean): bigint[] {
  const {quintant} = segmentToQuintant(segment, origin);
  const neighborSet = new Set<bigint>();

  // Left and right quintant on the same face (A, B)
  const leftQ = (quintant - 1 + 5) % 5;
  const rightQ = (quintant + 1) % 5;
  neighborSet.add(serializeRes1(origin, leftQ));
  neighborSet.add(serializeRes1(origin, rightQ));

  // Adjacent quintant on adjacent face (C)
  const [adjacentFaceId, adjacentQuintant] = FACE_ADJACENCY[origin.id][quintant];
  const adjacentOrigin = origins[adjacentFaceId];
  neighborSet.add(serializeRes1(adjacentOrigin, adjacentQuintant));

  if (edgeOnly) return Array.from(neighborSet).sort(compareBigint);

  // Remaining neighbors on face
  neighborSet.add(serializeRes1(origin, (quintant - 2 + 5) % 5));
  neighborSet.add(serializeRes1(origin, (quintant + 2) % 5));

  // Left & right quintant neighbors of C
  neighborSet.add(serializeRes1(adjacentOrigin, (adjacentQuintant - 1 + 5) % 5));
  neighborSet.add(serializeRes1(adjacentOrigin, (adjacentQuintant + 1) % 5));

  // Two neighbors each from adjacent faces of A & B
  const [leftAdjacentFaceId, leftAdjacentQuintant] = FACE_ADJACENCY[origin.id][leftQ];
  const leftAdjacentOrigin = origins[leftAdjacentFaceId];
  neighborSet.add(serializeRes1(leftAdjacentOrigin, leftAdjacentQuintant));
  neighborSet.add(serializeRes1(leftAdjacentOrigin, (leftAdjacentQuintant - 1 + 5) % 5));

  const [rightAdjacentFaceId, rightAdjacentQuintant] = FACE_ADJACENCY[origin.id][rightQ];
  const rightAdjacentOrigin = origins[rightAdjacentFaceId];
  neighborSet.add(serializeRes1(rightAdjacentOrigin, rightAdjacentQuintant));
  neighborSet.add(serializeRes1(rightAdjacentOrigin, (rightAdjacentQuintant + 1) % 5));

  return Array.from(neighborSet).sort(compareBigint);
}

/**
 * Get all neighbors of a cell across quintant and face boundaries.
 *
 * Within-quintant candidates are validated with `isNeighbor()` in uv space
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
  if (resolution === 1) return getRes1Neighbors(origin, segment, edgeOnly);

  const hilbertRes = resolution - FIRST_HILBERT_RESOLUTION + 1;
  const {quintant: sourceQuintant, orientation: sourceOrientation} = segmentToQuintant(segment, origin);
  const anchor = sToAnchor(S, hilbertRes, sourceOrientation);

  // Triple coordinates are orientation-independent
  const triple = anchorToTriple(anchor);

  // Get uv anchor for isNeighbor validation (within-quintant)
  const uvSourceAnchor = tripleToAnchor(triple, hilbertRes, 'uv');

  const neighborSet = new Set<bigint>();

  // --- Within-quintant: validated by isNeighbor() in uv space ---
  for (const neighborS of findQuintantNeighborS(triple, uvSourceAnchor, S, hilbertRes, sourceOrientation, edgeOnly)) {
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

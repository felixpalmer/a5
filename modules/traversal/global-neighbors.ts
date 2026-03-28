// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type { Orientation, Triple } from '../lattice';
import { sToAnchor, anchorToTriple, tripleToAnchor, tripleToS, tripleParity, tripleInBounds } from '../lattice';
import type { Origin } from '../core/utils';
import { deserialize, serialize, FIRST_HILBERT_RESOLUTION } from '../core/serialization';
import { segmentToQuintant, quintantToSegment, origins } from '../core/origin';
import { FACE_ADJACENCY } from '../core/face-adjacency';
import { compareBigint } from '../utils/bigint';
import { findQuintantNeighborS } from './quintant-neighbors';

/** Neighbor delta: [dx, dy, dz, isEdgeSharing] */
type NeighborDelta = [number, number, number, boolean];

/** Shared state for neighbor search helpers. */
interface NeighborContext {
  hilbertRes: number;
  resolution: number;
  maxS: bigint;
  maxRow: number;
  edgeOnly: boolean;
  neighborSet: Set<bigint>;
}

/**
 * Cross-quintant left-edge deltas (source z=0), indexed by `parity * 2 + (yOdd ? 1 : 0)`.
 * Applied to the swapped base triple [0, y, x] in the previous quintant.
 */
const LEFT_EDGE_DELTAS: NeighborDelta[][] = [
  /* parity=0, yEven */ [[0, 0, 0, true], [0, 0, 1, false]],
  /* parity=0, yOdd  */ [[0, 0, 0, true], [0, 1, 0, true], [0, -1, 1, false], [0, 1, -1, false]],
  /* parity=1, yEven */ [],
  /* parity=1, yOdd  */ [[0, -1, 0, true], [0, 0, -1, false]],
];

/**
 * Cross-quintant right-edge deltas (source x=0), indexed by `parity * 2 + (yOdd ? 1 : 0)`.
 * Applied to the swapped base triple [z, y, 0] in the next quintant.
 */
const RIGHT_EDGE_DELTAS: NeighborDelta[][] = [
  /* parity=0, yEven */ [[0, 0, 0, true], [0, 1, 0, true], [-1, 1, 0, false], [1, -1, 0, false]],
  /* parity=0, yOdd  */ [[0, 0, 0, true], [1, 0, 0, false]],
  /* parity=1, yEven */ [[0, -1, 0, true], [-1, 0, 0, false]],
  /* parity=1, yOdd  */ [],
];

/**
 * Cross-face base-edge deltas (source y=maxRow), indexed by parity.
 * Applied to the mirrored position [z, maxRow, x] on the adjacent face.
 */
const CROSS_FACE_DELTAS: NeighborDelta[][] = [
  /* parity=0 */ [[0, 0, 0, true], [1, 0, 0, true], [1, 0, -1, false]],
  /* parity=1 */ [[0, 0, -1, true], [0, 0, 0, false]],
];

/** Try to convert a triple to a cell ID and add it to the neighbor set. */
function addNeighbor(
  ctx: NeighborContext,
  neighborTriple: Triple, orientation: Orientation,
  neighborOrigin: Origin, neighborSegment: number
): void {
  const s = tripleToS(neighborTriple, ctx.hilbertRes, orientation);
  if (s === null || s < 0n || s >= ctx.maxS) return;
  ctx.neighborSet.add(serialize({origin: neighborOrigin, segment: neighborSegment, S: s, resolution: ctx.resolution}));
}

/** Apply a delta table to a base triple and add valid neighbors. */
function addDeltaNeighbors(
  ctx: NeighborContext,
  base: Triple, deltas: NeighborDelta[],
  orientation: Orientation, neighborOrigin: Origin, neighborSegment: number
): void {
  for (const [dx, dy, dz, isEdge] of deltas) {
    if (ctx.edgeOnly && !isEdge) continue;
    const neighborTriple: Triple = {x: base.x + dx, y: base.y + dy, z: base.z + dz};
    if (!tripleInBounds(neighborTriple, ctx.maxRow)) continue;
    addNeighbor(ctx, neighborTriple, orientation, neighborOrigin, neighborSegment);
  }
}

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
 * Uses three strategies:
 *
 * **Within-quintant**: Standard triple coordinate approach — generate ±1 candidate
 * triples, validate with isNeighbor in uv space, convert to cell IDs.
 *
 * **Cross-quintant**: Transform the source cell's IJ center into each adjacent
 * quintant's coordinate system, compute the "virtual" triple coordinates there,
 * then generate ±1 neighbor triples from that virtual position. Also transforms
 * out-of-bounds candidate triples through face-space to find their target quintant.
 * Both validated with isNeighbor() in uv space.
 *
 * **Cross-face**: For cells at the base edge (y=maxRow), maps to the adjacent
 * dodecahedron face using the x↔z swap rule. Validated by mirroring candidates
 * back to the source face and checking isNeighbor() in uv space.
 *
 * @param cellId - Full cell ID (bigint)
 * @param options.edgeOnly - If true, return only edge-sharing neighbors (5 per cell).
 *   Default false returns all neighbors including vertex-only neighbors (6-8 per cell).
 * @returns Array of neighbor cell IDs (bigint)
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

  const ctx: NeighborContext = {
    hilbertRes,
    resolution,
    maxS: 4n ** BigInt(hilbertRes),
    maxRow: (1 << hilbertRes) - 1,
    edgeOnly,
    neighborSet: new Set<bigint>(),
  };

  // --- Within-quintant neighbors ---
  for (const neighborS of findQuintantNeighborS(triple, uvSourceAnchor, S, hilbertRes, sourceOrientation, ctx.edgeOnly)) {
    ctx.neighborSet.add(serialize({origin, segment, S: neighborS, resolution}));
  }

  // --- Cross-quintant neighbors ---
  //
  // Adjacent quintants share a lateral edge. The left column of one quintant
  // (z=0) aligns with the right column of the next quintant (x=0) via a 180°
  // rotation. The triple coordinate mapping across lateral edges swaps x and z,
  // exactly like cross-face base edges.
  const parity = tripleParity(triple); // 0 or 1
  const yOdd = triple.y % 2 !== 0;
  const deltaIndex = parity * 2 + (yOdd ? 1 : 0);

  // Left edge (z=0): neighbor in previous quintant at swapped [0, y, x]
  if (triple.z === 0) {
    const targetQuintant = (sourceQuintant - 1 + 5) % 5;
    const {segment: targetSegment, orientation: targetOrientation} = quintantToSegment(targetQuintant, origin);
    const swappedBase: Triple = {x: 0, y: triple.y, z: triple.x};
    addDeltaNeighbors(ctx, swappedBase, LEFT_EDGE_DELTAS[deltaIndex], targetOrientation, origin, targetSegment);
  }

  // Right edge (x=0): neighbor in next quintant at swapped [z, y, 0]
  if (triple.x === 0) {
    const targetQuintant = (sourceQuintant + 1) % 5;
    const {segment: targetSegment, orientation: targetOrientation} = quintantToSegment(targetQuintant, origin);
    const swappedBase: Triple = {x: triple.z, y: triple.y, z: 0};
    addDeltaNeighbors(ctx, swappedBase, RIGHT_EDGE_DELTAS[deltaIndex], targetOrientation, origin, targetSegment);
  }

  // --- Cross-face neighbors ---
  // For cells at the base edge (y = maxRow), neighbors may lie on an adjacent
  // dodecahedron face. The base edge of each quintant is shared with a specific
  // quintant on an adjacent face. The triple coordinate mapping across the shared
  // edge swaps x and z: source [x, maxRow, z] ↔ target [z, maxRow, x].
  if (triple.y === ctx.maxRow) {
    const [adjFaceId, adjQuintant] = FACE_ADJACENCY[origin.id][sourceQuintant];
    const adjOrigin = origins[adjFaceId];
    const {segment: adjSegment, orientation: adjOrientation} = quintantToSegment(adjQuintant, adjOrigin);
    const mirroredBase: Triple = {x: triple.z, y: ctx.maxRow, z: triple.x};
    addDeltaNeighbors(ctx, mirroredBase, CROSS_FACE_DELTAS[parity], adjOrientation, adjOrigin, adjSegment);
  }

  // Apex: [0,0,0] cells from all 5 quintants meet at the face center
  if (triple.x === 0 && triple.y === 0 && triple.z === 0) {
    for (let q = 0; q < 5; q++) {
      if (q === sourceQuintant) continue;
      // Adjacent quintants (distance=1) share an edge; non-adjacent (distance=2) share only a vertex
      const distance = Math.min(
        (q - sourceQuintant + 5) % 5,
        (sourceQuintant - q + 5) % 5
      );
      if (ctx.edgeOnly && distance !== 1) continue;
      const {segment: targetSegment, orientation: targetOrientation} = quintantToSegment(q, origin);
      addNeighbor(ctx, triple, targetOrientation, origin, targetSegment);
    }
  }

  // Special case: base-left corner cells (triple [-maxRow, maxRow, 0]) sit at
  // dodecahedron vertices where 3 faces meet. Each vertex has 3 [-maxRow,maxRow,0]
  // cells (one from each face) that are mutual edge-sharing neighbors.
  //
  // The symmetric base-right corner [0, maxRow, -maxRow] does NOT need special
  // handling: its cross-quintant right-edge path lands on [-maxRow, maxRow, 0] in
  // Q+1 (same face), and its cross-face path lands on [-maxRow, maxRow, 0] on the
  // adjacent face — both of which are left corners that fully cover the vertex.
  if (triple.x === -ctx.maxRow && triple.y === ctx.maxRow && triple.z === 0) {
    // Corner cells are always edge-sharing neighbors (distance 0)
    // Vertex neighbor 1: across the previous quintant's base edge
    const prevQuintant = (sourceQuintant - 1 + 5) % 5;
    const [prevAdjFaceId, prevAdjQuintant] = FACE_ADJACENCY[origin.id][prevQuintant];
    const prevAdjOrigin = origins[prevAdjFaceId];
    const {segment: prevAdjSegment, orientation: prevAdjOrientation} = quintantToSegment(prevAdjQuintant, prevAdjOrigin);
    addNeighbor(ctx, triple, prevAdjOrientation, prevAdjOrigin, prevAdjSegment);

    // Vertex neighbor 2: adjacent quintant on the primary cross-face
    const [crossFaceId, crossQuintant] = FACE_ADJACENCY[origin.id][sourceQuintant];
    const crossOrigin = origins[crossFaceId];
    const nextCrossQuintant = (crossQuintant + 1) % 5;
    const {segment: crossSegment, orientation: crossOrientation} = quintantToSegment(nextCrossQuintant, crossOrigin);
    addNeighbor(ctx, triple, crossOrientation, crossOrigin, crossSegment);
  }

  return Array.from(ctx.neighborSet).sort(compareBigint);
}

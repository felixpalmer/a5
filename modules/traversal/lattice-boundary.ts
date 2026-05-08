// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type { Orientation, Triple } from '../lattice';
import { tripleToS, tripleInBounds } from '../lattice';
import type { Origin } from '../core/utils';
import { serialize } from '../core/serialization';
import { quintantToSegment, origins } from '../core/origin';
import { FACE_ADJACENCY } from '../core/face-adjacency';

/** Neighbor delta: [dx, dy, dz, isEdgeSharing] */
export type NeighborDelta = [number, number, number, boolean];

/**
 * Cross-quintant left-edge deltas (source z=0), indexed by `parity * 2 + (yOdd ? 1 : 0)`.
 * Applied to the swapped base triple [0, y, x] in the previous quintant.
 */
export const LEFT_EDGE_DELTAS: NeighborDelta[][] = [
  /* parity=0, yEven */ [[0, 0, 0, true], [0, 0, 1, false]],
  /* parity=0, yOdd  */ [[0, 0, 0, true], [0, 1, 0, true], [0, -1, 1, false], [0, 1, -1, false]],
  /* parity=1, yEven */ [],
  /* parity=1, yOdd  */ [[0, -1, 0, true], [0, 0, -1, false]],
];

/**
 * Cross-quintant right-edge deltas (source x=0), indexed by `parity * 2 + (yOdd ? 1 : 0)`.
 * Applied to the swapped base triple [z, y, 0] in the next quintant.
 */
export const RIGHT_EDGE_DELTAS: NeighborDelta[][] = [
  /* parity=0, yEven */ [[0, 0, 0, true], [0, 1, 0, true], [-1, 1, 0, false], [1, -1, 0, false]],
  /* parity=0, yOdd  */ [[0, 0, 0, true], [1, 0, 0, false]],
  /* parity=1, yEven */ [[0, -1, 0, true], [-1, 0, 0, false]],
  /* parity=1, yOdd  */ [],
];

/**
 * Cross-face base-edge deltas (source y=maxRow), indexed by parity.
 * Applied to the mirrored position [z, maxRow, x] on the adjacent face.
 */
export const CROSS_FACE_DELTAS: NeighborDelta[][] = [
  /* parity=0 */ [[0, 0, 0, true], [1, 0, 0, true], [1, 0, -1, false]],
  /* parity=1 */ [[0, 0, -1, true], [0, 0, 0, false]],
];

/** Source-cell context shared by all boundary-neighbor cases. */
export interface BoundaryContext {
  triple: Triple;
  parity: number;
  sourceQuintant: number;
  origin: Origin;
  hilbertRes: number;
  maxS: bigint;
  maxRow: number;
  resolution: number;
}

/** If the triple maps to a valid cell, append its cell ID to `out`. */
function pushTriple(
  out: bigint[], triple: Triple, orientation: Orientation,
  origin: Origin, segment: number, ctx: BoundaryContext,
): void {
  if (!tripleInBounds(triple, ctx.maxRow)) return;
  const s = tripleToS(triple, ctx.hilbertRes, orientation);
  if (s === null || s < 0n || s >= ctx.maxS) return;
  out.push(serialize({origin, segment, S: s, resolution: ctx.resolution}));
}

/** Apply a delta table to a base triple, appending each valid cell. */
function pushDeltas(
  out: bigint[], base: Triple, deltas: NeighborDelta[], edgeOnly: boolean,
  orientation: Orientation, origin: Origin, segment: number, ctx: BoundaryContext,
): void {
  for (const [dx, dy, dz, isEdge] of deltas) {
    if (edgeOnly && !isEdge) continue;
    pushTriple(out, {x: base.x + dx, y: base.y + dy, z: base.z + dz}, orientation, origin, segment, ctx);
  }
}

/**
 * Return every neighbor that lies outside the source cell's quintant: cross-quintant
 * lateral edges, cross-face base edge, apex (face center), and (when not `skipCorners`)
 * the `[-maxRow, maxRow, 0]` vertex corner. The within-quintant ±1 candidates are NOT
 * covered here — callers generate those directly.
 *
 * The result may contain duplicates and the order is not stable; callers
 * deduplicate (via Set) or accept duplicates if their downstream pipeline tolerates them.
 *
 * @param ctx         source-cell context
 * @param edgeOnly    drop apex non-adjacent quintants and other vertex-only neighbors
 * @param skipCorners drop the `[-maxRow, maxRow, 0]` corner — used when the caller's
 *                    connectivity (e.g. lattice ±1 moves) doesn't traverse that vertex
 */
export function getBoundaryNeighbors(
  ctx: BoundaryContext,
  edgeOnly: boolean,
  skipCorners = false,
): bigint[] {
  const out: bigint[] = [];
  const {triple, parity, sourceQuintant, origin, maxRow} = ctx;
  const yOdd = triple.y % 2 !== 0;
  const deltaIndex = parity * 2 + (yOdd ? 1 : 0);

  // Left edge (z=0): neighbor in previous quintant at swapped [0, y, x]
  if (triple.z === 0) {
    const targetQuintant = (sourceQuintant - 1 + 5) % 5;
    const {segment, orientation} = quintantToSegment(targetQuintant, origin);
    pushDeltas(out, {x: 0, y: triple.y, z: triple.x}, LEFT_EDGE_DELTAS[deltaIndex], edgeOnly,
      orientation, origin, segment, ctx);
  }

  // Right edge (x=0): neighbor in next quintant at swapped [z, y, 0]
  if (triple.x === 0) {
    const targetQuintant = (sourceQuintant + 1) % 5;
    const {segment, orientation} = quintantToSegment(targetQuintant, origin);
    pushDeltas(out, {x: triple.z, y: triple.y, z: 0}, RIGHT_EDGE_DELTAS[deltaIndex], edgeOnly,
      orientation, origin, segment, ctx);
  }

  // Base edge (y=maxRow): neighbor on adjacent face at mirrored [z, maxRow, x]
  if (triple.y === maxRow) {
    const [adjFaceId, adjQuintant] = FACE_ADJACENCY[origin.id][sourceQuintant];
    const adjOrigin = origins[adjFaceId];
    const {segment, orientation} = quintantToSegment(adjQuintant, adjOrigin);
    pushDeltas(out, {x: triple.z, y: maxRow, z: triple.x}, CROSS_FACE_DELTAS[parity], edgeOnly,
      orientation, adjOrigin, segment, ctx);
  }

  // Apex [0,0,0]: cells from all 5 quintants meet at the face center
  if (triple.x === 0 && triple.y === 0 && triple.z === 0) {
    for (let q = 0; q < 5; q++) {
      if (q === sourceQuintant) continue;
      const distance = Math.min((q - sourceQuintant + 5) % 5, (sourceQuintant - q + 5) % 5);
      if (edgeOnly && distance !== 1) continue;
      const {segment, orientation} = quintantToSegment(q, origin);
      pushTriple(out, triple, orientation, origin, segment, ctx);
    }
  }

  // Base-left corner [-maxRow, maxRow, 0]: 3 dodecahedron faces meet at this vertex.
  // The symmetric base-right corner is implicitly covered: its cross-quintant and
  // cross-face paths land on the [-maxRow, maxRow, 0] cell of neighboring quintants.
  if (!skipCorners && triple.x === -maxRow && triple.y === maxRow && triple.z === 0) {
    // Vertex neighbor 1: across the previous quintant's base edge
    const prevQuintant = (sourceQuintant - 1 + 5) % 5;
    const [prevAdjFaceId, prevAdjQuintant] = FACE_ADJACENCY[origin.id][prevQuintant];
    const prevAdjOrigin = origins[prevAdjFaceId];
    const {segment: prevAdjSegment, orientation: prevAdjOrientation} = quintantToSegment(prevAdjQuintant, prevAdjOrigin);
    pushTriple(out, triple, prevAdjOrientation, prevAdjOrigin, prevAdjSegment, ctx);

    // Vertex neighbor 2: adjacent quintant on the primary cross-face
    const [crossFaceId, crossQuintant] = FACE_ADJACENCY[origin.id][sourceQuintant];
    const crossOrigin = origins[crossFaceId];
    const nextCrossQuintant = (crossQuintant + 1) % 5;
    const {segment: crossSegment, orientation: crossOrientation} = quintantToSegment(nextCrossQuintant, crossOrigin);
    pushTriple(out, triple, crossOrientation, crossOrigin, crossSegment, ctx);
  }

  return out;
}

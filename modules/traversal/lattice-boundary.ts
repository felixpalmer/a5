// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type {Triple} from '../lattice';
import {tripleToS, tripleInBounds} from '../lattice';
import type {Origin} from '../core/utils';
import {serialize} from '../core/serialization';
import {quintantToSegment, origins} from '../core/origin';
import {FACE_ADJACENCY} from '../core/face-adjacency';

/** Neighbor delta: [dx, dy, dz, isEdgeSharing] */
export type NeighborDelta = [number, number, number, boolean];

/**
 * Cross-quintant left-edge deltas (source z=0), indexed by `parity * 2 + (yOdd ? 1 : 0)`.
 * Applied to the swapped base triple [0, y, x] in the previous quintant.
 */
// prettier-ignore
export const LEFT_EDGE_DELTAS: NeighborDelta[][] = [
  /* parity=0, yEven */ [[0, 0, 0, true], [0, 0, 1, false]],
  /* parity=0, yOdd  */ [[0, 0, 0, true], [0, 1, 0, true], [0, -1, 1, false], [0, 1, -1, false]],
  /* parity=1, yEven */ [],
  /* parity=1, yOdd  */ [[0, -1, 0, true], [0, 0, -1, false]]
];

/**
 * Cross-quintant right-edge deltas (source x=0), indexed by `parity * 2 + (yOdd ? 1 : 0)`.
 * Applied to the swapped base triple [z, y, 0] in the next quintant.
 */
// prettier-ignore
export const RIGHT_EDGE_DELTAS: NeighborDelta[][] = [
  /* parity=0, yEven */ [[0, 0, 0, true], [0, 1, 0, true], [-1, 1, 0, false], [1, -1, 0, false]],
  /* parity=0, yOdd  */ [[0, 0, 0, true], [1, 0, 0, false]],
  /* parity=1, yEven */ [[0, -1, 0, true], [-1, 0, 0, false]],
  /* parity=1, yOdd  */ []
];

/**
 * Cross-face base-edge deltas (source y=maxRow), indexed by parity.
 * Applied to the mirrored position [z, maxRow, x] on the adjacent face.
 */
// prettier-ignore
export const CROSS_FACE_DELTAS: NeighborDelta[][] = [
  /* parity=0 */ [[0, 0, 0, true], [1, 0, 0, true], [1, 0, -1, false]],
  /* parity=1 */ [[0, 0, -1, true], [0, 0, 0, false]]
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

/** Source-cell fields the boundary-triple walk needs (no encoding state). */
export type BoundaryTripleContext = Pick<BoundaryContext, 'triple' | 'parity' | 'sourceQuintant' | 'origin' | 'maxRow'>;

/** If the triple is a valid cell, append it to `out` as (originId, quintant, x, y, z). */
function pushTriple(
  out: number[],
  x: number,
  y: number,
  z: number,
  originId: number,
  quintant: number,
  maxRow: number
): void {
  if (!tripleInBounds({x, y, z}, maxRow)) return;
  out.push(originId, quintant, x, y, z);
}

/** Apply a delta table to a base triple, appending each valid cell. */
function pushDeltas(
  out: number[],
  base: Triple,
  deltas: NeighborDelta[],
  edgeOnly: boolean,
  originId: number,
  quintant: number,
  maxRow: number
): void {
  for (const [dx, dy, dz, isEdge] of deltas) {
    if (edgeOnly && !isEdge) continue;
    pushTriple(out, base.x + dx, base.y + dy, base.z + dz, originId, quintant, maxRow);
  }
}

/**
 * Every neighbor that lies outside the source cell's quintant, appended to
 * `out` as flat (originId, quintant, x, y, z) quintuples: cross-quintant
 * lateral edges, cross-face base edge, apex (face center), and (when not
 * `skipCorners`) the `[-maxRow, maxRow, 0]` vertex corner. The within-quintant
 * ±1 candidates are NOT covered here — callers generate those directly.
 *
 * Only cells on a quintant edge (x = 0, z = 0 or y = maxRow) have any. The
 * result may contain duplicates; callers deduplicate.
 *
 * @param ctx         source-cell context
 * @param edgeOnly    drop apex non-adjacent quintants and other vertex-only neighbors
 * @param skipCorners drop the `[-maxRow, maxRow, 0]` corner — used when the caller's
 *                    connectivity (e.g. lattice ±1 moves) doesn't traverse that vertex
 */
export function getBoundaryNeighborTriples(
  ctx: BoundaryTripleContext,
  edgeOnly: boolean,
  skipCorners: boolean,
  out: number[]
): void {
  const {triple, parity, sourceQuintant, origin, maxRow} = ctx;
  const yOdd = triple.y % 2 !== 0;
  const deltaIndex = parity * 2 + (yOdd ? 1 : 0);

  // Left edge (z=0): neighbor in previous quintant at swapped [0, y, x]
  if (triple.z === 0) {
    const targetQuintant = (sourceQuintant - 1 + 5) % 5;
    pushDeltas(
      out,
      {x: 0, y: triple.y, z: triple.x},
      LEFT_EDGE_DELTAS[deltaIndex],
      edgeOnly,
      origin.id,
      targetQuintant,
      maxRow
    );
  }

  // Right edge (x=0): neighbor in next quintant at swapped [z, y, 0]
  if (triple.x === 0) {
    const targetQuintant = (sourceQuintant + 1) % 5;
    pushDeltas(
      out,
      {x: triple.z, y: triple.y, z: 0},
      RIGHT_EDGE_DELTAS[deltaIndex],
      edgeOnly,
      origin.id,
      targetQuintant,
      maxRow
    );
  }

  // Base edge (y=maxRow): neighbor on adjacent face at mirrored [z, maxRow, x]
  if (triple.y === maxRow) {
    const [adjFaceId, adjQuintant] = FACE_ADJACENCY[origin.id][sourceQuintant];
    pushDeltas(
      out,
      {x: triple.z, y: maxRow, z: triple.x},
      CROSS_FACE_DELTAS[parity],
      edgeOnly,
      adjFaceId,
      adjQuintant,
      maxRow
    );
  }

  // Apex [0,0,0]: cells from all 5 quintants meet at the face center
  if (triple.x === 0 && triple.y === 0 && triple.z === 0) {
    for (let q = 0; q < 5; q++) {
      if (q === sourceQuintant) continue;
      const distance = Math.min((q - sourceQuintant + 5) % 5, (sourceQuintant - q + 5) % 5);
      if (edgeOnly && distance !== 1) continue;
      pushTriple(out, 0, 0, 0, origin.id, q, maxRow);
    }
  }

  // Base-left corner [-maxRow, maxRow, 0]: 3 dodecahedron faces meet at this vertex.
  // The symmetric base-right corner is implicitly covered: its cross-quintant and
  // cross-face paths land on the [-maxRow, maxRow, 0] cell of neighboring quintants.
  if (!skipCorners && triple.x === -maxRow && triple.y === maxRow && triple.z === 0) {
    // Vertex neighbor 1: across the previous quintant's base edge
    const prevQuintant = (sourceQuintant - 1 + 5) % 5;
    const [prevAdjFaceId, prevAdjQuintant] = FACE_ADJACENCY[origin.id][prevQuintant];
    pushTriple(out, triple.x, triple.y, triple.z, prevAdjFaceId, prevAdjQuintant, maxRow);

    // Vertex neighbor 2: adjacent quintant on the primary cross-face
    const [crossFaceId, crossQuintant] = FACE_ADJACENCY[origin.id][sourceQuintant];
    pushTriple(out, triple.x, triple.y, triple.z, crossFaceId, (crossQuintant + 1) % 5, maxRow);
  }
}

/**
 * The neighbors outside the source cell's quintant (see
 * `getBoundaryNeighborTriples`), as cell IDs.
 *
 * The result may contain duplicates and the order is not stable; callers
 * deduplicate (via Set) or accept duplicates if their downstream pipeline tolerates them.
 */
export function getBoundaryNeighbors(ctx: BoundaryContext, edgeOnly: boolean, skipCorners = false): bigint[] {
  const triples: number[] = [];
  getBoundaryNeighborTriples(ctx, edgeOnly, skipCorners, triples);
  const out: bigint[] = [];
  for (let i = 0; i < triples.length; i += 5) {
    const origin = origins[triples[i]];
    const {segment, orientation} = quintantToSegment(triples[i + 1], origin);
    const s = tripleToS({x: triples[i + 2], y: triples[i + 3], z: triples[i + 4]}, ctx.hilbertRes, orientation);
    if (s === null || s < 0n || s >= ctx.maxS) continue;
    out.push(serialize({origin, segment, S: s, resolution: ctx.resolution}));
  }
  return out;
}

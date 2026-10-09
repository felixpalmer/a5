// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type {Triple} from '../lattice';
import {tripleFlavor, tripleInBounds} from '../lattice';
import type {Origin} from '../core/utils';
import {FACE_ADJACENCY, seamTriple} from '../core/face-adjacency';
import {NEIGHBOR_DELTAS} from './neighbors';

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

/** The source cell of a boundary-neighbor lookup. */
export interface BoundaryTripleContext {
  triple: Triple;
  parity: number;
  sourceQuintant: number;
  origin: Origin;
  maxRow: number;
}

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

  // Base edge (y=maxRow): across the face seam the lattice continues, so the
  // neighbors on the adjacent face are those of the cell's image there
  if (triple.y === maxRow) {
    const [adjFaceId, adjQuintant] = FACE_ADJACENCY[origin.id][sourceQuintant];
    const image = seamTriple(triple, maxRow);
    // The image's pentagon is the cell's turned half-way round: its flavor's parity bit flipped
    const deltas = NEIGHBOR_DELTAS[tripleFlavor(triple, maxRow) ^ 1];
    const list = edgeOnly ? deltas.edge : deltas.all;
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      // Only steps back towards the seam (dy < 0) can land inside the neighbor quintant
      if (d.y < 0) pushTriple(out, image.x + d.x, image.y + d.y, image.z + d.z, adjFaceId, adjQuintant, maxRow);
    }
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

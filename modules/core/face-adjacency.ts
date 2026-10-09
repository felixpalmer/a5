// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type {Triple} from '../lattice';
import {TWO_PI_OVER_5} from './constants';
import {BASIS} from './pentagon';
import type {OriginId} from './utils';

// Computed empirically from cell boundary vertex sharing at resolution 4.
// TODO: generate from configuration in origin.ts

/**
 * Face adjacency table: FACE_ADJACENCY[originId][quintant] = [adjOriginId, adjQuintant]
 *
 * For each quintant on each face, this gives the primary adjacent face/quintant
 * that shares the base edge.
 *
 */
// prettier-ignore
export const FACE_ADJACENCY: [OriginId, number][][] = [
  [[1, 2], [4, 3], [5, 4], [6, 0], [11, 1]], // origin 0
  [[2, 3], [4, 4], [0, 0], [11, 0], [10, 1]], // origin 1
  [[9, 2], [3, 0], [4, 0], [1, 0], [10, 0]], // origin 2
  [[2, 1], [9, 1], [8, 1], [5, 1], [4, 1]], // origin 3
  [[2, 2], [3, 4], [5, 0], [0, 1], [1, 1]], // origin 4
  [[4, 2], [3, 3], [8, 0], [6, 1], [0, 2]], // origin 5
  [[0, 3], [5, 3], [8, 4], [7, 1], [11, 2]], // origin 6
  [[11, 3], [6, 3], [8, 3], [9, 4], [10, 3]], // origin 7
  [[5, 2], [3, 2], [9, 0], [7, 2], [6, 2]], // origin 8
  [[8, 2], [3, 1], [2, 0], [10, 4], [7, 3]], // origin 9
  [[2, 4], [1, 4], [11, 4], [7, 4], [9, 3]], // origin 10
  [[1, 3], [0, 4], [6, 4], [7, 0], [10, 2]] // origin 11
];

// The seam across a base edge. Unfolded about the edge, quintant q of a face
// and quintant FACE_ADJACENCY[originId][q] of its neighbor continue one
// lattice: in each quintant's own lattice coordinates (IJ, in face units) the
// point ij of one is the point (1, 1) - ij of the other, a half-turn about the
// edge's midpoint. `seamTransform` and `seamTriple` are this map in face
// coordinates and on cells.

/**
 * The map from a face's frame into the frame of its neighbor across the base
 * edge of `quintant`, as [a, b, c, d, tx, ty] taking (x, y) to
 * (a x + c y + tx, b x + d y + ty). With R(k) the rotation of quintant k into
 * place and q' the neighbor's quintant, it is p -> R(q') (BASIS (1, 1) - R(-q) p).
 */
export function seamTransform(originId: OriginId, quintant: number): Float64Array {
  const angle = TWO_PI_OVER_5 * FACE_ADJACENCY[originId][quintant][1];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // The linear part is R(q') R(-q) negated: a half-turn plus the change of quintant
  const turn = angle - TWO_PI_OVER_5 * quintant;
  const ex = BASIS[0] + BASIS[2];
  const ey = BASIS[1] + BASIS[3];
  return new Float64Array([
    -Math.cos(turn),
    -Math.sin(turn),
    Math.sin(turn),
    -Math.cos(turn),
    cos * ex - sin * ey,
    sin * ex + cos * ey
  ]);
}

/**
 * A cell's image across the seam at its quintant's base edge (`maxRow` is its
 * own), in the neighbor quintant's triples. The half-turn maps the lattice to
 * itself, so the image is a cell: its pentagon is the cell's own turned
 * half-way round, which flips the flavor's parity bit. It lies just outside
 * the neighbor quintant; its neighbors inside it are the cell's neighbors
 * across the seam.
 */
export function seamTriple(t: Triple, maxRow: number): Triple {
  return {x: -maxRow - t.x, y: 2 * maxRow + 1 - t.y, z: -maxRow - t.z};
}

/**
 * Breadth-first walk over the 12 dodecahedron faces (the resolution 0 cells),
 * adjacent across their edges. Starts from `seeds`, which are always expanded;
 * every other face is visited once and expanded only if `expand(face)` is true.
 * Stops after `maxRings` rings.
 *
 * @returns Every face reached, seeds first
 */
export function walkFaces(
  seeds: OriginId[],
  expand: (face: OriginId) => boolean,
  maxRings: number = Infinity
): OriginId[] {
  const reached: OriginId[] = [...new Set(seeds)];
  let frontier = reached.slice();
  for (let ring = 0; ring < maxRings && frontier.length > 0; ring++) {
    const next: OriginId[] = [];
    for (const id of frontier) {
      for (let q = 0; q < 5; q++) {
        const face = FACE_ADJACENCY[id][q][0];
        if (reached.includes(face)) continue;
        reached.push(face);
        if (expand(face)) next.push(face);
      }
    }
    frontier = next;
  }
  return reached;
}

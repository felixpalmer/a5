// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type { Anchor, Flip } from "../lattice";
import { getPentagonFlavor, PentagonFlavor } from "../core/tiling";

type ValidOffsetDelta = -2 | -1 | 0 | 1 | 2;
type NeighborPattern = [ValidOffsetDelta, ValidOffsetDelta, Flip, Flip]
const NEIGHBORS: Record<PentagonFlavor, NeighborPattern[]> = {
  0: [
       [0, -2, -1, 1], [0, -2, -1, -1],
       [0, -1, 1, -1], [0, -1, -1, -1], [0, -1, 1, 1],
       [1, -2, -1, -1],
       [1, -1, -1, 1], [1, -1, 1, -1], 
       [1, 0, 1, -1],
       [2, -1, 1, -1],
       [2, -2, -1, -1]
     ],
  1: [
      [-1, -1, -1, 1],
      [0, -2, -1, -1],
      [0, -1, -1, -1], [0, -1, 1, -1],
      [0, 0, -1, 1], [0, 0, -1, -1],
      [0, 1, 1, -1], [0, 1, 1, 1],
      [1, -2, -1, -1],
      [1, -1, 1, -1], [1, -1, -1, -1],
      [1, 0, 1, -1],
     ],
  2: [
       [-2, 2, -1, -1],
       [-2, 1, 1, -1],
       [-1, 0, 1, -1],
       [-1, 1, 1, -1], [-1, 1, -1, 1],
       [-1, 2, -1, -1],
       [0, 1, -1, -1], [0, 1, 1, -1], [0, 1, 1, 1],
       [0, 2, -1, -1], [0, 2, -1, 1],
     ],
  3: [
      [-1, 0, 1, -1],
      [-1, 1, 1, -1], [-1, 1, -1, -1],
      [-1, 2, -1, -1],
      [0, -1, 1, -1], [0, -1, 1, 1],
      [0, 0, -1, -1], [0, 0, -1, 1],
      [0, 1, -1, -1], [0, 1, 1, -1],
      [0, 2, -1, -1],
      [1, 1, -1, 1],
    ],
  4: [
       [0, -1, 1, -1], [0, -1, 1, 1], 
       [0, 0, -1, -1], [0, 0, -1, 1],
       [0, 1, -1, -1],
       [1, 0, -1, -1], [1, 0, 1, -1],
       [1, -1, 1, -1], [1, 1, -1, 1],
       [2, -1, 1, -1], [2, 0, -1, -1]
     ],
  5: [
       [-1, 1, -1, 1],
       [0, -1, 1, -1],
       [0, 0, -1, -1],
       [0, 1, -1, -1], [0, 1, 1, -1], [0, 1, 1, 1],
       [0, 2, -1, -1], [0, 2, -1, 1],
       [1, -1, 1, -1],
       [1, 0, -1, -1], [1, 0, 1, -1],
       [1, 1, -1, -1],
     ],
  6: [
       [-2, 0, -1, -1],
       [-2, 1, 1, -1],
       [-1, -1, -1, 1],
       [-1, 0, -1, -1], [-1, 0, 1, -1],
       [-1, 1, 1, -1],
       [0, -1, -1, -1],
       [0, 0, -1, -1], [0, 0, -1, 1],
       [0, 1, 1, -1], [0, 1, 1, 1],
     ],
  7: [
       [-1, -1, -1, -1],
       [-1, 0, -1, -1], [-1, 0, 1, -1],
       [-1, 1, 1, -1],
       [0, -2, -1, -1], [0, -2, -1, 1],
       [0, -1, -1, -1], [0, -1, 1, -1], [0, -1, 1, 1],
       [0, 0, -1, -1],
       [0, 1, 1, -1],
       [1, -1, -1, 1],
     ]
}

export function isNeighbor(origin: Anchor, candidate: Anchor): boolean {
  const originFlavor = getPentagonFlavor(origin);
  const candidateFlavor = getPentagonFlavor(candidate);
  if (originFlavor === candidateFlavor) return false;
  const neighbors = NEIGHBORS[originFlavor];
  const relative = [
    candidate.offset[0] - origin.offset[0],
    candidate.offset[1] - origin.offset[1],
    candidate.flips[0] * origin.flips[0],
    candidate.flips[1] * origin.flips[1]
  ] as NeighborPattern;

  for (let i = 0; i < neighbors.length; i++) {
    if (
      relative[0] === neighbors[i][0] &&
      relative[1] === neighbors[i][1] &&
      relative[2] === neighbors[i][2] &&
      relative[3] === neighbors[i][3]
    ) {
      return true;
    }
  }

  return false;
}
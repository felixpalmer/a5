// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type { OriginId } from './utils';

// Computed empirically from cell boundary vertex sharing at resolution 4.
// TODO: generate from configuration in origin.ts

/**
 * Face adjacency table: FACE_ADJACENCY[originId][quintant] = [adjOriginId, adjQuintant]
 *
 * For each quintant on each face, this gives the primary adjacent face/quintant
 * that shares the base edge.
 *
 */
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
  [[1, 3], [0, 4], [6, 4], [7, 0], [10, 2]], // origin 11
];
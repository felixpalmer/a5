// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// Cells handled in triple space — (originId, quintant, x, y, z) — by the
// traversal algorithms that walk many neighboring cells: they key and dedup
// cells as plain integers and encode a cell to its ID only when it is output.

import type {Orientation} from '../lattice';
import {tripleToS} from '../lattice';
import {serialize} from '../core/serialization';
import {origins, quintantToSegment} from '../core/origin';

// A cell's key packs the quintant (origin.id * 5 + quintant, < 60), parity,
// and the low KEY_BITS bits of -x and -z (y follows) into 51 bits, exact as a
// JS number. Up to Hilbert resolution 21 the coordinates fit whole; above it,
// two cells of one quintant share a key only if they are 2^22 rows apart, and a
// walk holding both would need ~2^21 steps (~10^12 cells for a disk) — far past
// what fits in memory. Keys are only built, never decoded (division and modulo
// on doubles are slow).
const KEY_BITS = 22;
const KEY_MASK = (1 << KEY_BITS) - 1;
const KEY_SIDE = 2 ** KEY_BITS;

/** The integer key of a cell, unique among the cells of any one traversal. */
export function tripleCellKey(originId: number, quintant: number, x: number, y: number, z: number): number {
  return (
    (((0 - x) & KEY_MASK) * KEY_SIDE + ((0 - z) & KEY_MASK)) * 2 +
    x +
    y +
    z +
    (originId * 5 + quintant) * 2 * KEY_SIDE * KEY_SIDE
  );
}

// Segment and curve orientation of each of the 60 quintants, by origin.id * 5 +
// quintant. Filled on first use: calling quintantToSegment at module load
// leaves V8 type feedback that slows serialize everywhere (uncompact 2x).
const QUINTANT_SEGMENT: number[] = [];
const QUINTANT_ORIENTATION: Orientation[] = [];

/** The cell ID of a cell given in triple space. */
export function tripleCellToId(
  originId: number,
  quintant: number,
  x: number,
  y: number,
  z: number,
  hilbertRes: number,
  resolution: number
): bigint {
  if (QUINTANT_SEGMENT.length === 0) {
    for (const origin of origins) {
      for (let q = 0; q < 5; q++) {
        const {segment, orientation} = quintantToSegment(q, origin);
        QUINTANT_SEGMENT.push(segment);
        QUINTANT_ORIENTATION.push(orientation);
      }
    }
  }
  const q = originId * 5 + quintant;
  const s = tripleToS({x, y, z}, hilbertRes, QUINTANT_ORIENTATION[q])!;
  return serialize({origin: origins[originId], segment: QUINTANT_SEGMENT[q], S: s, resolution});
}

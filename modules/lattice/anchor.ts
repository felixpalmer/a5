// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type { IJ } from '../core/coordinate-systems';
import type { Anchor, Quaternary, Flip, Orientation } from './types';

/**
 * Determine which orientation group is used for lookup table selection.
 * Group 1: uv, vu, vw, wv (default)
 * Group 2: uw, wu
 */
function isGroup2Orientation(orientation: Orientation): boolean {
  return orientation === 'uw' || orientation === 'wu';
}

/**
 * Deduce the quaternary value q from offset and flip values.
 *
 * Uses the discovered invariant that q can be deterministically computed
 * from offset parity and flip values. This enables full anchor reconstruction
 * when only partial information is available (e.g., from NEIGHBORS array).
 *
 * The anchor components form a constrained system where only 16 of 64 possible
 * (q, i%2, j%2, flip0, flip1) combinations actually occur.
 *
 * Pattern (varies by orientation group):
 * - For even i: q depends only on j parity
 * - For odd i: q ∈ {1, 3}, determined by j parity and flip combination
 *
 * Validated across all 6 orientations at resolutions 3-9. 100% accurate.
 */
export function computeQ(offset: IJ, flips: [Flip, Flip], orientation: Orientation = 'uv'): Quaternary {
  const [i, j] = offset;
  const [flip0, flip1] = flips;

  const imod2 = i & 1;
  const jmod2 = j & 1;
  const f0idx = (flip0 + 1) >> 1;  // Map: YES (-1) -> 0, NO (1) -> 1
  const f1idx = (flip1 + 1) >> 1;

  if (isGroup2Orientation(orientation)) {
    const group2Lookup = [
      [[[0, 3], [3, 0]], [[3, 2], [2, 3]]],
      [[[2, 1], [1, 2]], [[1, 0], [0, 1]]]
    ];
    return group2Lookup[imod2][jmod2][f0idx][f1idx] as Quaternary;
  } else {
    if (imod2 === 0) {
      return jmod2 === 0 ? 0 : 2;
    }
    const oddILookup = [
      [[3, 1], [1, 3]],
      [[1, 3], [3, 1]]
    ];
    return oddILookup[jmod2][f0idx][f1idx] as Quaternary;
  }
}

/**
 * Create a complete Anchor by deducing q from offset and flips.
 *
 * Useful when constructing neighbor anchors where you know the offset and flips
 * but need to deduce q.
 */
export function offsetFlipsToAnchor(offset: IJ, flips: [Flip, Flip], orientation: Orientation = 'uv'): Anchor {
  const q = computeQ(offset, flips, orientation);
  return { q, offset, flips };
}

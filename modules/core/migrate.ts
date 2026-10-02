// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {segmentToQuintant} from './origin';
import {deserialize, serialize, FIRST_HILBERT_RESOLUTION} from './serialization';
import {compatSToTriple, tripleToS} from '../lattice';

/**
 * Migrates a cell id from the v0 index (a5 <= 0.10, original curve) to the v1
 * index (non-self-intersecting curve). Both versions share the same cells and
 * the same origin/segment/resolution bits; only the curve position S within
 * the quintant differs, so the old S is decoded to its lattice triple and
 * re-encoded along the new curve.
 *
 * @param cell A cell id in the v0 index
 * @returns The id of the same cell in the v1 index
 */
export function migrate(cell: bigint): bigint {
  const {origin, segment, S, resolution} = deserialize(cell);
  if (resolution < FIRST_HILBERT_RESOLUTION) return cell;

  const {orientation} = segmentToQuintant(segment, origin);
  const hilbertResolution = 1 + resolution - FIRST_HILBERT_RESOLUTION;
  const triple = compatSToTriple(S, hilbertResolution, orientation);
  const newS = tripleToS(triple, hilbertResolution, orientation)!;
  return serialize({origin, segment, S: newS, resolution});
}

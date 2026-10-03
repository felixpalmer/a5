// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {faceStep, quintantToSegment} from './origin';
import {deserialize, serialize, FIRST_HILBERT_RESOLUTION} from './serialization';
import {compatSToTriple, tripleToS} from '../lattice';
import type {Orientation} from '../lattice';

// The v0 face layouts, by origin id (curve order): the quintant orientations
// and first quintant of every face. Windings are the same as in v1.
const FAN: Orientation[] = ['vu', 'uw', 'vw', 'vw', 'vw'];
const COUNTER_STEP: Orientation[] = ['wu', 'uv', 'wv', 'wu', 'uw'];
const COUNTER_JUMP: Orientation[] = ['vu', 'uv', 'wv', 'wu', 'uw'];
const CLOCKWISE_STEP: Orientation[] = ['wu', 'uw', 'vw', 'vu', 'uw'];
const V0_LAYOUTS: {orientation: Orientation[]; firstQuintant: number}[] = [
  {orientation: FAN, firstQuintant: 4},
  {orientation: COUNTER_JUMP, firstQuintant: 2},
  {orientation: COUNTER_STEP, firstQuintant: 3},
  {orientation: COUNTER_STEP, firstQuintant: 0},
  {orientation: CLOCKWISE_STEP, firstQuintant: 2},
  {orientation: COUNTER_JUMP, firstQuintant: 4},
  {orientation: CLOCKWISE_STEP, firstQuintant: 2},
  {orientation: CLOCKWISE_STEP, firstQuintant: 2},
  {orientation: COUNTER_STEP, firstQuintant: 3},
  {orientation: COUNTER_JUMP, firstQuintant: 0},
  {orientation: COUNTER_JUMP, firstQuintant: 3},
  {orientation: CLOCKWISE_STEP, firstQuintant: 0}
];

/**
 * Migrates a cell id from the v0 index (a5 <= 0.10) to the v1 index. Both
 * versions share the same cells; the v1 index threads the curve differently:
 * a new curve within each quintant, and a new quintant order on some faces.
 * So the cell is located in v0 terms (quintant + lattice triple, via the
 * original curve) and re-encoded in v1 terms.
 *
 * @param cell A cell id in the v0 index
 * @returns The id of the same cell in the v1 index
 */
export function migrate(cell: bigint): bigint {
  const {origin, segment, S, resolution} = deserialize(cell);
  if (resolution < FIRST_HILBERT_RESOLUTION - 1) return cell;

  // Locate the cell's quintant in the v0 layout. Windings are unchanged, so
  // the v0 face shares the v1 face's direction of travel.
  const v0 = V0_LAYOUTS[origin.id];
  const step = faceStep(origin);
  const faceRelativeQuintant = (segment - origin.firstQuintant + 5) % 5;
  const quintant = (v0.firstQuintant + step * faceRelativeQuintant + 5) % 5;
  const target = quintantToSegment(quintant, origin);
  if (resolution === FIRST_HILBERT_RESOLUTION - 1) {
    return serialize({origin, segment: target.segment, S: 0n, resolution});
  }

  const hilbertResolution = 1 + resolution - FIRST_HILBERT_RESOLUTION;
  const triple = compatSToTriple(S, hilbertResolution, v0.orientation[faceRelativeQuintant]);
  const newS = tripleToS(triple, hilbertResolution, target.orientation)!;
  return serialize({origin, segment: target.segment, S: newS, resolution});
}

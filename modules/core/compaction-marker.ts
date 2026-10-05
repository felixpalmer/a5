// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// The compaction marker: the value a compacted collection carries as its last
// element, recording the resolution its cells stand for. It is a value no cell
// can take: quintant 60 (only 0-59 exist), the resolution in bits 55-48, and the
// marker tag 1000000 in bits 6-0. Cell IDs end in a 1 followed by an odd number
// of zeros, or in one of the res-30 patterns ...1, ...100, ...10000, never in a 1
// followed by 6 zeros. The other bits carry no meaning yet: they are written as
// 0 and ignored when read.
//
//   63-58    57-56   55-48        47-7          6-0
//   111100   00      resolution   reserved (0)  1000000

import {QUINTANT_SHIFT, MAX_RESOLUTION} from './serialization';

const COMPACTION_MARKER_PREFIX = 60n << QUINTANT_SHIFT;
const COMPACTION_MARKER_END = 61n << QUINTANT_SHIFT;
const COMPACTION_MARKER_RESOLUTION_SHIFT = 48n;
const COMPACTION_MARKER_TAG = 0b1000000n;
const LOW_7_BITS = 0b1111111n;

/** The compaction marker recording `resolution`. */
export function compactionMarker(resolution: number): bigint {
  return COMPACTION_MARKER_PREFIX | (BigInt(resolution) << COMPACTION_MARKER_RESOLUTION_SHIFT) | COMPACTION_MARKER_TAG;
}

/** The resolution a compaction marker records. */
export function compactionMarkerResolution(value: bigint): number {
  return Number((value >> COMPACTION_MARKER_RESOLUTION_SHIFT) & 0xffn);
}

/**
 * Check whether a value is a compaction marker: the value a compacted collection
 * carries, as its last element, to record its resolution. It is not a cell.
 */
export function isCompactionMarker(value: bigint): boolean {
  return (
    value >= COMPACTION_MARKER_PREFIX &&
    value < COMPACTION_MARKER_END &&
    (value & LOW_7_BITS) === COMPACTION_MARKER_TAG &&
    compactionMarkerResolution(value) <= MAX_RESOLUTION
  );
}

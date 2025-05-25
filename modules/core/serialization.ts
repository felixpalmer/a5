// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { A5Cell } from "./utils";
import { Origin } from './utils';
import { origins } from "./origin";

export const FIRST_HILBERT_RESOLUTION = 3;
export const MAX_RESOLUTION = 31;
export const HILBERT_START_BIT = 58n; // 64 - 6 bits for origin & segment

// First 6 bits 0, remaining 58 bits 1
export const REMOVAL_MASK = 0x3ffffffffffffffn;

// First 6 bits 1, remaining 58 bits 0
export const ORIGIN_SEGMENT_MASK = 0xfc00000000000000n;

// All 64 bits 1
export const ALL_ONES = 0xffffffffffffffffn;

export function getResolution(index: bigint): number {
  // Find resolution from position of first non-00 bits from the right
  let resolution = MAX_RESOLUTION - 1;
  let shifted = index >> 1n; // TODO check if non-zero for point level
  while (resolution > 0 && (shifted & 0b1n) === 0n) {
    resolution -= 1;
    // For non-Hilbert resolutions, resolution marker moves by 1 bit per resolution
    // For Hilbert resolutions, resolution marker moves by 2 bits per resolution
    shifted = shifted >> (resolution < FIRST_HILBERT_RESOLUTION ? 1n : 2n);
  }

  return resolution;
}

export function deserialize(index: bigint): A5Cell {
  const resolution = getResolution(index);

  if (resolution === 0) {
    return { origin: origins[0], segment: 0, S: 0n, resolution };
  }

  // Extract origin*segment from top 6 bits
  const top6Bits = Number(index >> 58n);
  
  // Find origin and segment that multiply to give this product
  let origin: Origin, segment: number;

  if (resolution === 1) {
    const originId: number = top6Bits;
    origin = origins[originId];
    segment = 0;
  } else {
    const originId = Math.floor(top6Bits / 5);
    origin = origins[originId];
    segment = (top6Bits + origin.firstQuintant) % 5;
  }

  if (!origin) {
    throw new Error(`Could not parse origin: ${top6Bits}`);
  }

  if (resolution < FIRST_HILBERT_RESOLUTION) {
    return { origin, segment, S: 0n, resolution };
  }

  // Mask away origin & segment and shift away resolution and 00 bits
  const hilbertLevels = resolution - FIRST_HILBERT_RESOLUTION + 1;
  const hilbertBits = BigInt(2 * hilbertLevels);
  const shift = HILBERT_START_BIT - hilbertBits;
  const S = (index & REMOVAL_MASK) >> shift;
  return { origin, segment, S, resolution };
}

export function serialize(cell: A5Cell): bigint {
  const {origin, segment, S, resolution} = cell;
  if (resolution > MAX_RESOLUTION) {
    throw new Error(`Resolution (${resolution}) is too large`);
  }

  if (resolution === 0) return 0n;

  // Position of resolution marker as bit shift from LSB
  let R;
  if (resolution < FIRST_HILBERT_RESOLUTION) {
    // For non-Hilbert resolutions, resolution marker moves by 1 bit per resolution
    R = BigInt(resolution);
  } else {
    // For Hilbert resolutions, resolution marker moves by 2 bits per resolution
    const hilbertResolution = 1 + resolution - FIRST_HILBERT_RESOLUTION;
    R = BigInt(2 * hilbertResolution + 1);
  }

  // First 6 bits are the origin id and the segment
  const segmentN = (segment - origin.firstQuintant + 5) % 5;

  let index; 
  if (resolution === 1) {
    index = BigInt(origin.id) << 58n;
  } else {
    index = BigInt(5 * origin.id + segmentN) << 58n;
  }

  if (resolution >= FIRST_HILBERT_RESOLUTION) {
    // Number of bits required for S Hilbert curve
    const hilbertLevels = resolution - FIRST_HILBERT_RESOLUTION + 1;
    const hilbertBits = BigInt(2 * hilbertLevels);
    if (BigInt(S) >= (1n << hilbertBits)) {
      throw new Error(`S (${S}) is too large for resolution level ${resolution}`);
    }
    // Next (2 * hilbertResolution) bits are S (hilbert index within segment)
    index += BigInt(S) << (HILBERT_START_BIT - hilbertBits);
  }

  // Resolution is encoded by position of the least significant 1
  index |= 1n << (HILBERT_START_BIT - R);

  return index;
}

export function cellToChildren(index: bigint, childResolution?: number): bigint[] {
  const {origin, segment, S, resolution: currentResolution} = deserialize(index);
  const newResolution = childResolution ?? currentResolution + 1;

  if (newResolution <= currentResolution) {
    throw new Error(`Target resolution (${newResolution}) must be greater than current resolution (${currentResolution})`);
  }

  if (newResolution > MAX_RESOLUTION) {
    throw new Error(`Target resolution (${newResolution}) exceeds maximum resolution (${MAX_RESOLUTION})`);
  }


  let newOrigins: Origin[] = [origin];
  let newSegments: number[] = [segment];
  if (currentResolution === 0) {
    newOrigins = origins;
  }
  if (
    (currentResolution === 0 && newResolution > 1)
    || currentResolution === 1
    ) {
    newSegments = [0, 1, 2, 3, 4];
  }

  const resolutionDiff = newResolution - Math.max(currentResolution, FIRST_HILBERT_RESOLUTION - 1);
  const childrenCount = Math.pow(4, resolutionDiff);
  const children: bigint[] = [];
  const shiftedS = S << BigInt(2 * resolutionDiff);
  for (const newOrigin of newOrigins) {
    for (const newSegment of newSegments) {
      for (let i = 0; i < childrenCount; i++) {
        const newS = shiftedS + BigInt(i);
        children.push(serialize({origin: newOrigin, segment: newSegment, S: newS, resolution: newResolution}));
      }
    }
  }
  
  return children;
}

export function cellToParent(index: bigint, parentResolution?: number): bigint {
  const {origin, segment, S, resolution: currentResolution} = deserialize(index);
  const newResolution = parentResolution ?? currentResolution - 1;

  if (newResolution < 0) {
    throw new Error(`Target resolution (${newResolution}) cannot be negative`);
  }

  if (newResolution >= currentResolution) {
    throw new Error(`Target resolution (${newResolution}) must be less than current resolution (${currentResolution})`);
  }

  const resolutionDiff = currentResolution - newResolution;
  const shiftedS = S >> BigInt(2 * resolutionDiff);
  return serialize({origin, segment, S: shiftedS, resolution: newResolution});
}
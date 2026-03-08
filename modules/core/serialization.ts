// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { A5Cell } from "./utils";
import { Origin } from './utils';
import { origins } from "./origin";

export const FIRST_HILBERT_RESOLUTION = 2;
const MAX_RESOLUTION = 30;
const HILBERT_START_BIT = 58n; // 64 - 6 bits for origin & segment

// First 6 bits 0, remaining 58 bits 1
const REMOVAL_MASK = 0x3ffffffffffffffn;

// Abstract cell that contains the whole world, has resolution -1 and 12 children,
// which are the res0 cells.
export const WORLD_CELL = 0n;

export function getResolution(index: bigint): number {
  if (index === 0n) return -1;

  // Resolution 30: LSB is set (no other resolution has this)
  if (index & 1n) return MAX_RESOLUTION;

  let resolution = MAX_RESOLUTION - 1;
  let shifted = index >> 1n;
  if (shifted === 0n) return -1;

  // Fast path: split into 32-bit chunks and work with regular numbers (much faster than bigints)
  // Check low 32 bits first
  let low32 = Number(shifted & 0xFFFFFFFFn);
  let remaining: number;

  if (low32 === 0) {
    // Low 32 bits are all zero, skip 16 resolution levels and work with high bits
    shifted >>= 32n;
    resolution -= 16;
    // Now shifted fits in 32 bits (original max was 58 bits, now 26 bits)
    remaining = Number(shifted);
  } else {
    // Low 32 bits have data, work with them
    remaining = low32;
  }

  // Check remaining 16 bits
  if ((remaining & 0xFFFF) === 0) {
    remaining >>= 16;
    resolution -= 8;
  }

  // Check remaining 8 bits
  if (resolution >= 6 && (remaining & 0xFF) === 0) {
    remaining >>= 8;
    resolution -= 4;
  }

  // Check remaining 4 bits
  if (resolution >= 4 && (remaining & 0xF) === 0) {
    remaining >>= 4;
    resolution -= 2;
  }

  // Final loop with remaining bits (still as Number, much faster)
  while (resolution > -1 && (remaining & 0b1) === 0) {
    resolution -= 1;
    // For non-Hilbert resolutions, resolution marker moves by 1 bit per resolution
    // For Hilbert resolutions, resolution marker moves by 2 bits per resolution
    remaining = remaining >> (resolution < FIRST_HILBERT_RESOLUTION ? 1 : 2);
  }

  return resolution;
}

export function deserialize(index: bigint): A5Cell {
  const resolution = getResolution(index);

  // Technically not a resolution, but can be useful to think of as an
  // abstract cell that contains the whole world
  if (resolution === -1) {
    return { origin: origins[0], segment: 0, S: 0n, resolution };
  }

  if (resolution === MAX_RESOLUTION) {
    // Resolution 30: [5-bit quintant][58-bit S][1-bit marker]
    const quintant = Number(index >> 59n);
    const originId = Math.floor(quintant / 5);
    const origin = origins[originId];
    const segment = (quintant + origin.firstQuintant) % 5;
    const S = (index >> 1n) & ((1n << 58n) - 1n);
    return { origin, segment, S, resolution };
  }

  // Extract origin*segment from top 6 bits
  const top6Bits = Number(index >> 58n);
  
  // Find origin and segment that multiply to give this product
  let origin: Origin, segment: number;

  if (resolution === 0) {
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

  if (resolution === -1) return WORLD_CELL;

  if (resolution === MAX_RESOLUTION) {
    // Resolution 30 special encoding:
    // Conceptually 66 bits: [6-bit quintant][58-bit S][marker '10']
    // Encoded as 64 bits by dropping trailing '0' and leading '0':
    //   [5-bit quintant (0-31)][58-bit S][marker '1']
    const segmentN = (segment - origin.firstQuintant + 5) % 5;
    const quintant = 5 * origin.id + segmentN;
    if (quintant > 31) {
      throw new Error(`Quintant ${quintant} is too large for resolution ${MAX_RESOLUTION} (max 31)`);
    }
    const hilbertBits = 58n;
    if (BigInt(S) >= (1n << hilbertBits)) {
      throw new Error(`S (${S}) is too large for resolution level ${MAX_RESOLUTION}`);
    }
    let index = BigInt(quintant) << 59n;
    index |= BigInt(S) << 1n;
    index |= 1n;
    return index;
  }

  // Position of resolution marker as bit shift from LSB
  let R;
  if (resolution < FIRST_HILBERT_RESOLUTION) {
    // For non-Hilbert resolutions, resolution marker moves by 1 bit per resolution
    R = BigInt(resolution + 1);
  } else {
    // For Hilbert resolutions, resolution marker moves by 2 bits per resolution
    const hilbertResolution = 1 + resolution - FIRST_HILBERT_RESOLUTION;
    R = BigInt(2 * hilbertResolution + 1);
  }

  // First 6 bits are the origin id and the segment
  const segmentN = (segment - origin.firstQuintant + 5) % 5;

  let index; 
  if (resolution === 0) {
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

  if (newResolution < currentResolution) {
    throw new Error(`Target resolution (${newResolution}) must be equal to or greater than current resolution (${currentResolution})`);
  }

  if (newResolution > MAX_RESOLUTION) {
    throw new Error(`Target resolution (${newResolution}) exceeds maximum resolution (${MAX_RESOLUTION})`);
  }

  // If target resolution equals current resolution, return the original cell
  if (newResolution === currentResolution) {
    return [index];
  }

  let newOrigins: Origin[] = [origin];
  let newSegments: number[] = [segment];
  if (currentResolution === -1) {
    newOrigins = origins;
  }
  if (
    (currentResolution === -1 && newResolution > 0)
    || currentResolution === 0
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

  // Special case: parent of resolution 0 cells is the world cell
  if (newResolution === -1) {
    return WORLD_CELL;
  }

  if (newResolution < 0) {
    throw new Error(`Target resolution (${newResolution}) cannot be negative`);
  }

  if (newResolution > currentResolution) {
    throw new Error(`Target resolution (${newResolution}) must be equal to or less than current resolution (${currentResolution})`);
  }

  if (newResolution === currentResolution) {
    return index;
  }

  const resolutionDiff = currentResolution - newResolution;
  const shiftedS = S >> BigInt(2 * resolutionDiff);
  return serialize({origin, segment, S: shiftedS, resolution: newResolution});
}

/**
 * Returns resolution 0 cells of the A5 system, which serve as a starting point
 * for all higher-resolution subdivisions in the hierarchy.
 * 
 * @returns Array of 12 cell indices
 */
export function getRes0Cells(): bigint[] {
  return cellToChildren(WORLD_CELL, 0);
}

/**
 * Check for whether index corresponds to first child of its parent
 */
export function isFirstChild(index: bigint, resolution?: number): boolean {
  resolution ??= getResolution(index);

  if (resolution < 2) {
    // For resolution 0: first child is origin 0 (child count = 12)
    // For resolution 1: first children are at multiples of 5 (child count = 5)
    const top6Bits = Number(index >> HILBERT_START_BIT);
    const childCount = resolution === 0 ? 12 : 5;
    return top6Bits % childCount === 0;
  }

  if (resolution === MAX_RESOLUTION) {
    // For res 30, S occupies bits 58-1, so its 2 LSBs are at bits 2-1
    return (index & 0b110n) === 0n;
  }

  const sPosition = 2n * BigInt(MAX_RESOLUTION - resolution);
  const sMask = 3n << sPosition; // Mask for the 2 LSBs of S
  return (index & sMask) === 0n;
}

/**
 * Difference between two neighboring sibling cells at a given resolution
 */
export function getStride(resolution: number): bigint {
  // Both level 0 & 1 just write values 0-11 or 0-59 to the first 6 bits
  if (resolution < 2) return (1n << HILBERT_START_BIT);

  // For res 30, S is shifted left by 1 (marker bit at position 0)
  if (resolution === MAX_RESOLUTION) return 2n;

  // For hilbert levels, the position shifts by 2 bits per resolution level
  const sPosition = 2n * BigInt(MAX_RESOLUTION - resolution);
  return 1n << sPosition;
}
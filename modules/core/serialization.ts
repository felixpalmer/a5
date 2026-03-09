// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { A5Cell } from "./utils";
import { Origin } from './utils';
import { origins } from "./origin";

export const FIRST_HILBERT_RESOLUTION = 2;
const MAX_RESOLUTION = 30;
const HILBERT_START_BIT = 58n; // 64 - 6 bits for origin & segment

// Abstract cell that contains the whole world, has resolution -1 and 12 children,
// which are the res0 cells.
export const WORLD_CELL = 0n;

export function getResolution(index: bigint): number {
  if (index === 0n) return -1;

  // Resolution 30 uses three encoding patterns:
  //   ...1     → 5-bit quintant (0-31),  58-bit S
  //   ...100   → 3-bit quintant (32-39), 58-bit S
  //   ...10000 → 1-bit quintant (40-41), 58-bit S
  if ((index & 1n) || (index & 0b111n) === 0b100n || (index & 0b11111n) === 0b10000n) return MAX_RESOLUTION;

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

  // For res 30, quintant bits are fewer to make room for S:
  //   ...1     marker (1 bit)  → 5-bit quintant (0-31)
  //   ...100   marker (3 bits) → 3-bit quintant + 32 (32-39)
  //   ...10000 marker (5 bits) → 1-bit quintant + 40 (40-41)
  let quintantShift = HILBERT_START_BIT;
  let quintantOffset = 0;
  if (resolution === MAX_RESOLUTION) {
    const markerBits = (index & 1n) ? 1n : (index & 0b100n) ? 3n : 5n;
    quintantShift = HILBERT_START_BIT + markerBits;
    quintantOffset = markerBits === 1n ? 0 : markerBits === 3n ? 32 : 40;
  }

  // Extract origin*segment from top bits
  const topBits = Number(index >> quintantShift) + quintantOffset;

  // Find origin and segment
  let origin: Origin, segment: number;

  if (resolution === 0) {
    origin = origins[topBits];
    segment = 0;
  } else {
    const originId = Math.floor(topBits / 5);
    origin = origins[originId];
    segment = (topBits + origin.firstQuintant) % 5;
  }

  if (!origin) {
    throw new Error(`Could not parse origin: ${topBits}`);
  }

  if (resolution < FIRST_HILBERT_RESOLUTION) {
    return { origin, segment, S: 0n, resolution };
  }

  // Mask away origin & segment and shift away resolution and marker bits
  const hilbertLevels = resolution - FIRST_HILBERT_RESOLUTION + 1;
  const hilbertBits = BigInt(2 * hilbertLevels);
  const removalMask = (1n << quintantShift) - 1n;
  const S = (index & removalMask) >> (quintantShift - hilbertBits);
  return { origin, segment, S, resolution };
}

export function serialize(cell: A5Cell): bigint {
  const {origin, segment, S, resolution} = cell;
  if (resolution > MAX_RESOLUTION) {
    throw new Error(`Resolution (${resolution}) is too large`);
  }

  if (resolution === -1) return WORLD_CELL;

  // For res 30, quintant bits are fewer to make room for S:
  //   quintant 0-31:  ...1     marker → 5-bit quintant
  //   quintant 32-39: ...100   marker → 3-bit quintant + 32
  //   quintant 40-41: ...10000 marker → 1-bit quintant + 40
  //   quintant 42+:   fall back to res 29
  let quintantShift = HILBERT_START_BIT;

  // Position of resolution marker as bit shift from LSB
  let R;
  if (resolution < FIRST_HILBERT_RESOLUTION) {
    R = BigInt(resolution + 1);
  } else {
    const hilbertResolution = 1 + resolution - FIRST_HILBERT_RESOLUTION;
    R = BigInt(2 * hilbertResolution + 1);
  }

  // Top bits encode the origin id and segment
  const segmentN = (segment - origin.firstQuintant + 5) % 5;

  let index;
  if (resolution === 0) {
    index = BigInt(origin.id) << quintantShift;
  } else {
    const quintant = 5 * origin.id + segmentN;
    if (resolution === MAX_RESOLUTION) {
      let quintantValue: number;
      if (quintant <= 31) {
        quintantShift = HILBERT_START_BIT + 1n;
        quintantValue = quintant;
      } else if (quintant <= 39) {
        quintantShift = HILBERT_START_BIT + 3n;
        quintantValue = quintant - 32;
      } else if (quintant <= 41) {
        quintantShift = HILBERT_START_BIT + 5n;
        quintantValue = quintant - 40;
      } else {
        return serialize({origin, segment, S: S >> 2n, resolution: MAX_RESOLUTION - 1});
      }
      index = BigInt(quintantValue) << quintantShift;
    } else {
      index = BigInt(quintant) << quintantShift;
    }
  }

  if (resolution >= FIRST_HILBERT_RESOLUTION) {
    const hilbertLevels = resolution - FIRST_HILBERT_RESOLUTION + 1;
    const hilbertBits = BigInt(2 * hilbertLevels);
    if (BigInt(S) >= (1n << hilbertBits)) {
      throw new Error(`S (${S}) is too large for resolution level ${resolution}`);
    }
    index += BigInt(S) << (quintantShift - hilbertBits);
  }

  // Resolution is encoded by position of the least significant 1
  index |= 1n << (quintantShift - R);

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
    // S's 2 LSBs sit just above the marker bits
    const markerBits = (index & 1n) ? 1n : (index & 0b100n) ? 3n : 5n;
    return (index & (3n << markerBits)) === 0n;
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
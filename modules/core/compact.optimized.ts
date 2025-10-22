// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

/**
 * Optimized implementation of compact/uncompact functions for A5 DGGS.
 *
 * This version exploits the bit structure of A5 indices for better performance,
 * using bit manipulation instead of serialize/deserialize operations.
 */

import {
  getResolution,
  WORLD_CELL,
  FIRST_HILBERT_RESOLUTION,
  HILBERT_START_BIT,
  ORIGIN_SEGMENT_MASK
} from './serialization';

/**
 * Uncompact a set of cells to a target resolution using bit manipulation.
 *
 * This optimized version directly manipulates bits to expand cells without
 * going through serialize/deserialize cycles.
 *
 * @param cells - Array of cell indices to uncompact
 * @param targetResolution - Resolution to expand all cells to
 * @returns Array of cell indices all at the target resolution
 */
export function uncompact(cells: bigint[], targetResolution: number): bigint[] {
  const result: bigint[] = [];

  for (const cell of cells) {
    const resolution = getResolution(cell);

    if (resolution === targetResolution) {
      // Already at target resolution
      result.push(cell);
    } else if (resolution < targetResolution) {
      // Need to expand
      result.push(...expandCell(cell, resolution, targetResolution));
    } else {
      throw new Error(
        `Cannot uncompact cell at resolution ${resolution} to lower resolution ${targetResolution}`
      );
    }
  }

  return result;
}

/**
 * Expand a single cell from its current resolution to target resolution.
 * Uses bit manipulation to generate all children.
 */
function expandCell(cell: bigint, currentResolution: number, targetResolution: number): bigint[] {
  // Special cases for resolution -1 and 0
  if (currentResolution === -1) {
    // World cell - generate all 12 resolution 0 cells
    if (targetResolution === 0) {
      const result: bigint[] = [];
      for (let originId = 0; originId < 12; originId++) {
        result.push((BigInt(originId) << 58n) | (1n << 57n)); // res 0 marker at bit 57
      }
      return result;
    } else {
      // Expand world to res 0, then recursively expand
      const res0Cells = expandCell(WORLD_CELL, -1, 0);
      const result: bigint[] = [];
      for (const res0Cell of res0Cells) {
        result.push(...expandCell(res0Cell, 0, targetResolution));
      }
      return result;
    }
  }

  if (currentResolution === 0) {
    // Resolution 0 -> resolution 1 (5 segments)
    const originId = Number(cell >> 58n);

    // Calculate firstQuintant for this origin (from origin.ts pattern)
    // This is a simplified version - in practice we'd need the full origin data
    // For now, use the origin data implicitly through the bit pattern
    const result: bigint[] = [];

    if (targetResolution === 1) {
      // Generate 5 segments for this origin
      for (let segN = 0; segN < 5; segN++) {
        const top6 = 5 * originId + segN;
        const res1Cell = (BigInt(top6) << 58n) | (1n << 56n); // res 1 marker at bit 56
        result.push(res1Cell);
      }
      return result;
    } else {
      // Expand to res 1 first, then continue
      const res1Cells = expandCell(cell, 0, 1);
      for (const res1Cell of res1Cells) {
        result.push(...expandCell(res1Cell, 1, targetResolution));
      }
      return result;
    }
  }

  // For Hilbert resolutions (2+), use bit shifting
  if (currentResolution >= FIRST_HILBERT_RESOLUTION && targetResolution >= FIRST_HILBERT_RESOLUTION) {
    const result: bigint[] = [];
    const resolutionDiff = targetResolution - currentResolution;

    // Extract origin/segment (top 6 bits)
    const originSegment = cell & ORIGIN_SEGMENT_MASK;

    // Extract S value
    const currentHilbertLevels = currentResolution - FIRST_HILBERT_RESOLUTION + 1;
    const currentHilbertBits = 2 * currentHilbertLevels;
    const currentShift = HILBERT_START_BIT - BigInt(currentHilbertBits);
    const S = (cell >> currentShift) & ((1n << BigInt(currentHilbertBits)) - 1n);

    // Calculate new S values (shift left and add all possible suffixes)
    const shiftAmount = 2 * resolutionDiff;
    const childCount = 1 << shiftAmount; // 4^resolutionDiff
    const shiftedS = S << BigInt(shiftAmount);

    // Calculate target encoding parameters
    const targetHilbertLevels = targetResolution - FIRST_HILBERT_RESOLUTION + 1;
    const targetHilbertBits = 2 * targetHilbertLevels;
    const targetShift = HILBERT_START_BIT - BigInt(targetHilbertBits);
    const targetR = 2 * targetHilbertLevels + 1;

    for (let i = 0; i < childCount; i++) {
      const newS = shiftedS + BigInt(i);

      // Reconstruct index: origin/segment | S | resolution marker
      const newCell = originSegment | (newS << targetShift) | (1n << (HILBERT_START_BIT - BigInt(targetR)));
      result.push(newCell);
    }

    return result;
  }

  // Mixed case: current res is 1, target is 2+
  if (currentResolution === 1 && targetResolution >= FIRST_HILBERT_RESOLUTION) {
    // Expand res 1 -> res 2, then continue if needed
    const originSegment = cell & ORIGIN_SEGMENT_MASK;
    const result: bigint[] = [];

    if (targetResolution === 2) {
      // Generate 4 children at res 2 (S = 0, 1, 2, 3 with 2-bit encoding)
      for (let s = 0n; s < 4n; s++) {
        // res 2: hilbert levels = 1, hilbert bits = 2, shift = 58 - 2 = 56, R = 3 (bit 55)
        const res2Cell = originSegment | (s << 56n) | (1n << 55n);
        result.push(res2Cell);
      }
      return result;
    } else {
      // Expand to res 2 first
      const res2Cells = expandCell(cell, 1, 2);
      for (const res2Cell of res2Cells) {
        result.push(...expandCell(res2Cell, 2, targetResolution));
      }
      return result;
    }
  }

  // Shouldn't reach here for valid inputs
  throw new Error(`Unsupported expansion from resolution ${currentResolution} to ${targetResolution}`);
}

/**
 * Compact a set of cells using bit-based sibling detection.
 *
 * This optimized version uses bit patterns to identify sibling relationships
 * without full deserialization.
 *
 * @param cells - Array of cell indices to compact
 * @returns Compacted array of cell indices (typically smaller)
 */
export function compact(cells: bigint[]): bigint[] {
  if (cells.length === 0) {
    return [];
  }

  // Remove duplicates
  let currentSet = new Set(Array.from(new Set(cells)));

  // Keep compacting until no more changes
  let changed = true;
  while (changed) {
    changed = false;
    const nextSet = new Set<bigint>();
    const processed = new Set<bigint>();

    // Group cells by potential parent
    const parentMap = new Map<bigint, bigint[]>();

    for (const cell of currentSet) {
      if (processed.has(cell)) continue;

      const resolution = getResolution(cell);

      // World cell can't be compacted further
      if (resolution === -1) {
        nextSet.add(cell);
        processed.add(cell);
        continue;
      }

      // Calculate parent cell using bit manipulation
      const parent = getParentCell(cell, resolution);

      if (!parentMap.has(parent)) {
        parentMap.set(parent, []);
      }
      parentMap.get(parent)!.push(cell);
      processed.add(cell);
    }

    // Check if we have complete sibling groups
    for (const [parent, children] of parentMap) {
      const parentResolution = getResolution(parent);

      // Determine expected child count
      let expectedChildren = 4; // Default for Hilbert resolutions
      if (parentResolution === -1) {
        expectedChildren = 12; // World -> res 0
      } else if (parentResolution === 0) {
        expectedChildren = 5; // Res 0 -> res 1 (segments)
      }

      if (children.length === expectedChildren) {
        // All siblings present - replace with parent
        nextSet.add(parent);
        changed = true;
      } else {
        // Keep the children
        for (const child of children) {
          nextSet.add(child);
        }
      }
    }

    currentSet = nextSet;
  }

  return Array.from(currentSet).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Get the parent cell using bit manipulation.
 * This avoids the overhead of deserialize/serialize cycles.
 */
function getParentCell(cell: bigint, resolution: number): bigint {
  if (resolution === 0) {
    // Parent is world cell
    return WORLD_CELL;
  }

  if (resolution === 1) {
    // Parent is res 0 - extract origin from top 6 bits
    const top6 = Number(cell >> 58n);
    const originId = Math.floor(top6 / 5);
    // Res 0 cell: origin in top 6 bits, marker at bit 57
    return (BigInt(originId) << 58n) | (1n << 57n);
  }

  // Hilbert resolutions: shift S right by 2 bits
  const originSegment = cell & ORIGIN_SEGMENT_MASK;

  const hilbertLevels = resolution - FIRST_HILBERT_RESOLUTION + 1;
  const hilbertBits = 2 * hilbertLevels;
  const shift = HILBERT_START_BIT - BigInt(hilbertBits);

  // Extract S
  const S = (cell >> shift) & ((1n << BigInt(hilbertBits)) - 1n);

  // Parent S is shifted right by 2 bits
  const parentS = S >> 2n;

  // Parent resolution encoding
  const parentResolution = resolution - 1;
  const parentHilbertLevels = parentResolution - FIRST_HILBERT_RESOLUTION + 1;
  const parentHilbertBits = 2 * parentHilbertLevels;
  const parentShift = HILBERT_START_BIT - BigInt(parentHilbertBits);
  const parentR = 2 * parentHilbertLevels + 1;

  // Reconstruct parent index
  return originSegment | (parentS << parentShift) | (1n << (HILBERT_START_BIT - BigInt(parentR)));
}

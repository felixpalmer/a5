// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

/**
 * Optimized implementation of compact/uncompact functions for A5 DGGS.
 *
 * This version uses cellToChildren for expansion and bit-based sibling detection
 * for compaction.
 */

import {
  getResolution,
  cellToChildren,
  cellToParent,
  FIRST_HILBERT_RESOLUTION,
  HILBERT_START_BIT,
  MAX_RESOLUTION
} from './serialization';

import { getNumChildren } from './cell-info';

export function uncompact(cells: bigint[] | BigUint64Array, targetResolution: number): BigUint64Array {
  // First calculate how much space is needed
  let n = 0;
  const resolutions = new Uint8Array(cells.length);
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const resolution = getResolution(cell);
    const resolutionDiff = targetResolution - resolution;
    if (resolutionDiff < 0) {
      throw new Error(
        `Cannot uncompact cell at resolution ${resolution} to lower resolution ${targetResolution}`
      );
    }

    resolutions[i] = resolution;
    n += getNumChildren(resolution, targetResolution);
  }

  // Write directly into pre-allocated array
  const result = new BigUint64Array(n);
  let offset = 0;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const resolution = resolutions[i];

    const numChildren = getNumChildren(resolution, targetResolution);
    if (numChildren === 1) {
      result[offset] = cell;
    } else {
      result.set(cellToChildren(cell, targetResolution), offset);
    }

    offset += numChildren;
  }

  return result;
}

/**
 * Compact a set of cells using forward-scanning algorithm.
 *
 * Key optimizations:
 * 1. Single sort at the start
 * 2. Forward scan detects complete sibling groups using stride
 * 3. Multiple passes, but no re-sorting (parents maintain sort order)
 *
 * @param cells - Array or TypedArray of cell indices to compact
 * @returns BigUint64Array of compacted cell indices (typically smaller)
 */
export function compactForwardScan(cells: bigint[] | BigUint64Array): BigUint64Array {
  if (cells.length === 0) {
    return new BigUint64Array(0);
  }

  // Single sort and dedup
  let currentCells = Array.from(new Set(cells)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  // Helper to get expected sibling count from cell resolution
  function getExpectedChildCount(cellResolution: number): number {
    if (cellResolution === 0) return 12;  // parent is -1 (world cell)
    if (cellResolution === 1) return 5;   // parent is 0
    return 4;                              // parent is 1+ (Hilbert)
  }

  // Helper to calculate stride between siblings at a given resolution
  // Siblings increment the S value by 1, which translates to a fixed stride in the cell index
  function getStride(resolution: number): bigint {
    if (resolution < FIRST_HILBERT_RESOLUTION) {
      // For non-Hilbert resolutions, there's no simple stride (different origins/segments)
      throw new Error(`getStride not applicable for resolution ${resolution}`);
    }

    // For Hilbert resolutions: siblings differ by incrementing S by 1
    // S is stored at position (HILBERT_START_BIT - hilbertBits)
    // So incrementing S by 1 means adding (1 << sPosition) to the cell index
    const hilbertLevels = resolution - FIRST_HILBERT_RESOLUTION + 1;
    const hilbertBits = BigInt(2 * hilbertLevels);
    const sPosition = HILBERT_START_BIT - hilbertBits;
    return 1n << sPosition;
  }

  // Compact until no more changes
  // No re-sorting needed - parents maintain sorted order!
  let changed = true;
  while (changed) {
    changed = false;
    const result: bigint[] = [];
    let i = 0;

    while (i < currentCells.length) {
      const cell = currentCells[i];
      const resolution = getResolution(cell);

      // Can't compact below resolution 0
      if (resolution < 0) {
        result.push(cell);
        i++;
        continue;
      }

      // Special case: resolution 0 → world cell
      // Resolution 0 cells don't have a constant stride (different origins)
      if (resolution === 0) {
        if (i + 12 <= currentCells.length) {
          let allRes0 = true;
          for (let j = 0; j < 12; j++) {
            if (getResolution(currentCells[i + j]) !== 0) {
              allRes0 = false;
              break;
            }
          }
          if (allRes0) {
            result.push(0n);
            i += 12;
            changed = true;
            continue;
          }
        }
        result.push(cell);
        i++;
        continue;
      }

      // Check for complete sibling group
      const expectedChildren = getExpectedChildCount(resolution);

      if (i + expectedChildren <= currentCells.length) {
        let hasAllSiblings = true;

        if (resolution >= FIRST_HILBERT_RESOLUTION) {
          // For Hilbert resolutions: use stride-based checking
          // BUT: cells only form a complete sibling group if the first cell's S value is divisible by 4
          // This means the 2 least significant bits of S (before the resolution marker) must be 00
          // Check: cell & (3n << sPosition) === 0
          const hilbertLevels = resolution - FIRST_HILBERT_RESOLUTION + 1;
          const hilbertBits = BigInt(2 * hilbertLevels);
          const sPosition = HILBERT_START_BIT - hilbertBits;
          const sMask = 3n << sPosition; // Mask for the 2 LSBs of S
          const stride = 1n << sPosition; // Calculate stride

          // Only check stride if the first cell could be the start of a sibling group
          if ((cell & sMask) === 0n) {
            for (let j = 1; j < expectedChildren; j++) {
              const expectedCell = cell + BigInt(j) * stride;
              if (currentCells[i + j] !== expectedCell) {
                hasAllSiblings = false;
                break;
              }
            }
          } else {
            // First cell is not at a sibling group boundary
            hasAllSiblings = false;
          }
        } else {
          // For resolution 1: can't use stride (different origins), fall back to parent check
          for (let j = 1; j < expectedChildren; j++) {
            const siblingResolution = getResolution(currentCells[i + j]);
            if (siblingResolution !== resolution) {
              hasAllSiblings = false;
              break;
            }
          }
          // Only check parents if all resolutions match
          if (hasAllSiblings) {
            const parent = cellToParent(cell);
            for (let j = 1; j < expectedChildren; j++) {
              const siblingParent = cellToParent(currentCells[i + j]);
              if (siblingParent !== parent) {
                hasAllSiblings = false;
                break;
              }
            }
          }
        }

        if (hasAllSiblings) {
          // Compute parent only once when needed
          const parent = cellToParent(cell);
          result.push(parent);
          i += expectedChildren;
          changed = true;
          continue;
        }
      }

      result.push(cell);
      i++;
    }

    currentCells = result;
  }

  const finalResult = new BigUint64Array(currentCells.length);
  for (let i = 0; i < currentCells.length; i++) {
    finalResult[i] = currentCells[i];
  }
  return finalResult;
}

/**
 * Compact a set of cells using Set-based sibling detection.
 *
 * This version groups cells by parent and checks for complete sibling sets.
 *
 * @param cells - Array or TypedArray of cell indices to compact
 * @returns BigUint64Array of compacted cell indices (typically smaller)
 */
export function compact(cells: bigint[] | BigUint64Array): BigUint64Array {
  if (cells.length === 0) {
    return new BigUint64Array(0);
  }

  // Remove duplicates
  let currentSet = new Set<bigint>();
  for (let i = 0; i < cells.length; i++) {
    currentSet.add(cells[i]);
  }

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

      // Cells below resolution 0 can't be compacted
      if (resolution < 0) {
        nextSet.add(cell);
        processed.add(cell);
        continue;
      }

      // Special handling for resolution 0 cells - they all compact to world cell (0n)
      if (resolution === 0) {
        if (!parentMap.has(0n)) {
          parentMap.set(0n, []);
        }
        parentMap.get(0n)!.push(cell);
        processed.add(cell);
        continue;
      }

      // Calculate parent cell
      const parent = cellToParent(cell);

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

  // Convert Set to sorted BigUint64Array
  const sortedArray = Array.from(currentSet).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const result = new BigUint64Array(sortedArray.length);
  for (let i = 0; i < sortedArray.length; i++) {
    result[i] = sortedArray[i];
  }
  return result;
}

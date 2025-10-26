// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

/**
 * Optimized implementation of compact/uncompact functions for A5 DGGS.
 *
 * This version uses cellToChildren for expansion and stride-based sibling detection
 * for compaction.
 */

import {
  getResolution,
  cellToChildren,
  cellToParent,
  getStride,
  isFirstChild
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
export function compact(cells: bigint[] | BigUint64Array): BigUint64Array {
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

      // Check for complete sibling group using unified stride-based approach
      const expectedChildren = getExpectedChildCount(resolution);

      if (i + expectedChildren <= currentCells.length) {
        let hasAllSiblings = true;

        // Use stride-based checking for all resolutions
        // First check if this cell is a first child (at a sibling group boundary)
        if (isFirstChild(cell, resolution)) {
          const stride = getStride(resolution);

          // Check that all expected siblings are present with correct stride
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
 * Kept for performance comparison.
 *
 * @param cells - Array or TypedArray of cell indices to compact
 * @returns BigUint64Array of compacted cell indices (typically smaller)
 */
export function _compact(cells: bigint[] | BigUint64Array): BigUint64Array {
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

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
  cellToParent
} from './serialization';

/**
 * Uncompact a set of cells to a target resolution using cellToChildren.
 *
 * @param cells - Array or TypedArray of cell indices to uncompact
 * @param targetResolution - Resolution to expand all cells to
 * @returns BigUint64Array of cell indices all at the target resolution
 */
export function uncompact(cells: bigint[] | BigUint64Array, targetResolution: number): BigUint64Array {
  // Collect results in a temporary array
  const tempResults: bigint[] = [];

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const resolution = getResolution(cell);

    if (resolution === targetResolution) {
      // Already at target resolution
      tempResults.push(cell);
    } else if (resolution < targetResolution) {
      // Need to expand - use cellToChildren
      tempResults.push(...cellToChildren(cell, targetResolution));
    } else {
      throw new Error(
        `Cannot uncompact cell at resolution ${resolution} to lower resolution ${targetResolution}`
      );
    }
  }

  // Convert to BigUint64Array
  const result = new BigUint64Array(tempResults.length);
  for (let i = 0; i < tempResults.length; i++) {
    result[i] = tempResults[i];
  }
  return result;
}

/**
 * Compact a set of cells using bit-based sibling detection.
 *
 * This optimized version uses bit patterns to identify sibling relationships
 * without full deserialization.
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

      // World cell can't be compacted further
      if (resolution === -1) {
        nextSet.add(cell);
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

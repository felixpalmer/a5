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
  isFirstChild,
  FIRST_HILBERT_RESOLUTION
} from './serialization';

import { getNumChildren } from './cell-info';
import { compareBigint } from '../utils/bigint';

/**
 * Expand a set of cells to a target resolution by generating all descendant cells.
 *
 * **Ordering property**: If the input is sorted, the output is also sorted.
 * This holds because A5 cell IDs encode the origin/quintant in the high bits
 * and the Hilbert curve position below that, so all children of a cell form a
 * contiguous, ordered block in ID space. Consequently, `children(A) < children(B)`
 * whenever `A < B`.
 */
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
 * @param cells - Array or TypedArray of cell indices to compact
 * @returns BigUint64Array of compacted cell indices (typically smaller)
 */
export function compact(cells: bigint[] | BigUint64Array): BigUint64Array {
  if (cells.length === 0) {
    return new BigUint64Array(0);
  }

  // Single sort and dedup
  let currentCells = Array.from(new Set(cells)).sort(compareBigint);

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
      const expectedChildren = resolution >= FIRST_HILBERT_RESOLUTION ?
        4 : ( // Hilbert levels have 4 siblings
          resolution === 0 ? 12 : 5 // First two levels are exceptions, with 12 & 5 siblings
        );

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

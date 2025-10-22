// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

/**
 * Naive implementation of compact/uncompact functions for A5 DGGS.
 *
 * This is a straightforward, easy-to-understand implementation that serves as
 * a reference and baseline for performance testing. It uses higher-level
 * operations rather than bit manipulation.
 */

import { deserialize, serialize, cellToParent, cellToChildren, WORLD_CELL } from './serialization';

/**
 * Uncompact a set of cells to a target resolution.
 *
 * Takes an array of cell indices (which may be at different resolutions) and
 * expands them all to the specified target resolution. This is useful for
 * ensuring all cells in a set are at the same resolution level for analysis.
 *
 * @param cells - Array of cell indices to uncompact
 * @param targetResolution - Resolution to expand all cells to
 * @returns Array of cell indices all at the target resolution
 *
 * @example
 * // Expand a parent cell to its children
 * const parent = serialize({origin: origins[0], segment: 0, S: 0n, resolution: 2});
 * const children = uncompact([parent], 3);
 * // children will contain 4 cells at resolution 3
 */
export function uncompact(cells: bigint[], targetResolution: number): bigint[] {
  const result: bigint[] = [];

  for (const cell of cells) {
    const cellData = deserialize(cell);

    if (cellData.resolution === targetResolution) {
      // Cell is already at target resolution
      result.push(cell);
    } else if (cellData.resolution < targetResolution) {
      // Expand cell to target resolution
      const children = cellToChildren(cell, targetResolution);
      result.push(...children);
    } else {
      // Cell is at higher resolution than target - this is an error
      throw new Error(
        `Cannot uncompact cell at resolution ${cellData.resolution} to lower resolution ${targetResolution}`
      );
    }
  }

  return result;
}

/**
 * Compact a set of cells by replacing children with parents where possible.
 *
 * Takes an array of cell indices and attempts to simplify it by replacing
 * complete sets of sibling cells with their parent cell. This process repeats
 * recursively until no more compaction is possible.
 *
 * The algorithm:
 * 1. Group cells by their parent
 * 2. If all siblings are present, replace them with the parent
 * 3. Repeat until no more compaction is possible
 *
 * @param cells - Array of cell indices to compact
 * @returns Compacted array of cell indices (typically smaller)
 *
 * @example
 * // Compact 4 sibling cells into their parent
 * const parent = serialize({origin: origins[0], segment: 0, S: 0n, resolution: 2});
 * const children = cellToChildren(parent, 3);
 * const compacted = compact(children);
 * // compacted will contain 1 cell (the parent) instead of 4 children
 */
export function compact(cells: bigint[]): bigint[] {
  if (cells.length === 0) {
    return [];
  }

  // Remove duplicates
  const uniqueCells = Array.from(new Set(cells));

  // Keep compacting until no more changes occur
  let changed = true;
  let currentSet = new Set(uniqueCells);

  while (changed) {
    changed = false;
    const nextSet = new Set<bigint>();
    const processed = new Set<bigint>();

    // Group cells by their parent
    const parentMap = new Map<bigint, bigint[]>();

    for (const cell of currentSet) {
      if (processed.has(cell)) continue;

      const cellData = deserialize(cell);

      // Can't compact resolution -1 (world cell)
      if (cellData.resolution === -1) {
        nextSet.add(cell);
        processed.add(cell);
        continue;
      }

      // Resolution 0 cells have world cell as parent
      const parent = cellData.resolution === 0 ? WORLD_CELL : cellToParent(cell);

      if (!parentMap.has(parent)) {
        parentMap.set(parent, []);
      }
      parentMap.get(parent)!.push(cell);
      processed.add(cell);
    }

    // Check each parent group
    for (const [parent, children] of parentMap) {
      const parentData = deserialize(parent);

      // Determine expected number of children
      let expectedChildren = 4; // Default for Hilbert resolutions
      if (parentData.resolution === -1) {
        expectedChildren = 12; // World cell has 12 res-0 children
      } else if (parentData.resolution === 0) {
        expectedChildren = 5; // Res-0 cells have 5 res-1 children (segments)
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

  return Array.from(currentSet).sort((a, b) => {
    // Sort by numeric value for consistent output
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

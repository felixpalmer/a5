// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {cellArea, getNumChildren} from '../core/cell-info';
import {isCompactionMarker} from '../core/compaction-marker';
import {checkedResolution} from '../core/serialization';
import {getCompactionResolution} from './resolution';
import type {Cells} from './types';

/**
 * The number of cells in a set at its resolution: the length of the
 * uncompacted set. This differs from the length of a compacted array. Each
 * cell given is counted, so overlapping cells are counted more than once; use
 * `union` to merge them first.
 *
 * @param cells - Set of cells (compacted or not)
 * @returns Number of cells at the set's resolution
 * @throws If a value is neither an A5 cell ID nor a compaction marker
 */
export function count(cells: Cells): bigint {
  const resolution = BigInt(getCompactionResolution(cells));
  // Children per cell, by cell resolution + 1 (the world cell is -1)
  const children: bigint[] = [];
  let total = 0n;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (isCompactionMarker(cell)) continue;
    const r = checkedResolution(cell);
    total += children[r + 1] ??= getNumChildren(BigInt(r), resolution);
  }
  return total;
}

/**
 * The area of a set of cells, in square meters. Exact, as A5 cells are
 * equal-area. Overlapping cells each add their area; use `union` to merge them
 * first.
 *
 * @param cells - Set of cells (compacted or not)
 * @returns Area in square meters
 * @throws If a value is neither an A5 cell ID nor a compaction marker
 */
export function area(cells: Cells): number {
  let total = 0;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (isCompactionMarker(cell)) continue;
    total += cellArea(checkedResolution(cell));
  }
  return total;
}

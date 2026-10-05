// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {isCompactionMarker} from '../core/compaction-marker';
import {cellFirstSlot, cellFirstSlotUnchecked, cellSlotCount, checkedResolution} from '../core/serialization';
import {getCompactionResolution} from './resolution';
import {appendSlotRun, slotRunsToCollection, toSlotRuns} from './slot-runs';
import type {Cells, SlotRuns} from './types';

/** Merge two lists of slot runs, keeping slots in either. */
function unionSlotRuns(a: SlotRuns, b: SlotRuns): SlotRuns {
  const out: SlotRuns = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (j >= b.length || (i < a.length && a[i] <= b[j])) {
      appendSlotRun(out, a[i], a[i + 1]);
      i += 2;
    } else {
      appendSlotRun(out, b[j], b[j + 1]);
      j += 2;
    }
  }
  return out;
}

/** Slots in both lists of slot runs. */
function intersectSlotRuns(a: SlotRuns, b: SlotRuns): SlotRuns {
  const out: SlotRuns = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const lo = a[i] > b[j] ? a[i] : b[j];
    const hi = a[i + 1] < b[j + 1] ? a[i + 1] : b[j + 1];
    if (lo < hi) out.push(lo, hi);
    if (a[i + 1] < b[j + 1]) i += 2;
    else j += 2;
  }
  return out;
}

/** Slots in the first list of slot runs but not the second. */
function differenceSlotRuns(a: SlotRuns, b: SlotRuns): SlotRuns {
  const out: SlotRuns = [];
  let j = 0;
  for (let i = 0; i < a.length; i += 2) {
    let lo = a[i];
    const hi = a[i + 1];
    while (j < b.length && b[j + 1] <= lo) j += 2;
    let k = j;
    while (k < b.length && b[k] < hi) {
      if (b[k] > lo) out.push(lo, b[k]);
      if (b[k + 1] > lo) lo = b[k + 1];
      k += 2;
    }
    if (lo < hi) out.push(lo, hi);
  }
  return out;
}

/**
 * The resolution of two sets of cells, which must be the same: A5 resolutions
 * don't nest geometrically, so combining sets at different ones has no meaning.
 */
function sameResolution(a: Cells, b: Cells): number {
  const resolutionA = getCompactionResolution(a);
  const resolutionB = getCompactionResolution(b);
  if (resolutionA !== resolutionB) {
    throw new Error(`Cannot combine cells at resolution ${resolutionA} with cells at resolution ${resolutionB}`);
  }
  return resolutionA;
}

/** Combine two sets of cells as slot runs, compacted at their resolution. */
function combine(a: Cells, b: Cells, operation: (a: SlotRuns, b: SlotRuns) => SlotRuns): BigUint64Array {
  const resolution = sameResolution(a, b);
  return slotRunsToCollection(operation(toSlotRuns(a), toSlotRuns(b)), resolution);
}

/**
 * The union of two sets of cells: cells in either. Both sets must be at the
 * same resolution, and the result is compacted at it.
 *
 * @param a - First set of cells (compacted or not)
 * @param b - Second set of cells (compacted or not)
 * @returns Compacted cells, with a compaction marker recording the resolution
 * @throws If the sets are at different resolutions, or a value is neither an A5 cell ID nor a compaction marker
 */
export function union(a: Cells, b: Cells): BigUint64Array {
  return combine(a, b, unionSlotRuns);
}

/**
 * The intersection of two sets of cells: cells in both. Both sets must be at
 * the same resolution, and the result is compacted at it.
 *
 * @param a - First set of cells (compacted or not)
 * @param b - Second set of cells (compacted or not)
 * @returns Compacted cells, with a compaction marker recording the resolution
 * @throws If the sets are at different resolutions, or a value is neither an A5 cell ID nor a compaction marker
 */
export function intersect(a: Cells, b: Cells): BigUint64Array {
  return combine(a, b, intersectSlotRuns);
}

/**
 * The difference of two sets of cells: cells in `a` but not in `b`. Both sets
 * must be at the same resolution, and the result is compacted at it.
 *
 * @param a - Set of cells to subtract from (compacted or not)
 * @param b - Set of cells to subtract (compacted or not)
 * @returns Compacted cells, with a compaction marker recording the resolution
 * @throws If the sets are at different resolutions, or a value is neither an A5 cell ID nor a compaction marker
 */
export function difference(a: Cells, b: Cells): BigUint64Array {
  return combine(a, b, differenceSlotRuns);
}

/**
 * Check whether two sets of cells share any cell. Both sets must be at the same
 * resolution.
 *
 * @param a - First set of cells (compacted or not)
 * @param b - Second set of cells (compacted or not)
 * @returns Whether some cell is in both sets
 * @throws If the sets are at different resolutions, or a value is neither an A5 cell ID nor a compaction marker
 */
export function overlaps(a: Cells, b: Cells): boolean {
  sameResolution(a, b);
  return intersectSlotRuns(toSlotRuns(a), toSlotRuns(b)).length > 0;
}

/**
 * Check whether a cell is in a set of cells. The cell must be at the set's
 * resolution: A5 cells don't nest geometrically across resolutions, so for a
 * point-in-polygon test pass `lonLatToCell(point, resolution)` with the
 * resolution of the set. Uses a binary search, so `cells` must be sorted in
 * curve order, as returned by `compact` and the other A5 functions.
 *
 * @param cells - Sorted set of cells (compacted or not)
 * @param cell - Cell to test, at the set's resolution
 * @returns Whether the cell is in the set
 * @throws If the cell is at a different resolution from the set, or it, or the set's cell the search
 *   lands on, is not an A5 cell ID
 */
export function contains(cells: Cells, cell: bigint): boolean {
  const resolution = getCompactionResolution(cells);
  const cellResolution = checkedResolution(cell);
  if (cellResolution !== resolution) {
    throw new Error(`Cannot test a cell at resolution ${cellResolution} against cells at resolution ${resolution}`);
  }
  const slot = cellFirstSlot(cell);
  let n = cells.length;
  if (n > 0 && isCompactionMarker(cells[n - 1])) n--;

  // The last cell starting at or before the cell's first slot is the only one
  // that can hold it. Only that cell is checked to be a cell: the search steps
  // just need an order
  let low = 0;
  let high = n - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (cellFirstSlotUnchecked(cells[mid]) <= slot) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found >= 0 && slot < cellFirstSlot(cells[found]) + cellSlotCount(cells[found]);
}

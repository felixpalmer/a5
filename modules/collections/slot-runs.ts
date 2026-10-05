// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// The collection engine. Each cell covers a block of leaf slots (see
// core/serialization), so a set of cells is a list of sorted, disjoint slot runs:
// cells are turned into slot runs, set operations merge runs, and runs are
// turned back into the coarsest cells covering them. Nothing is uncompacted.

import {compactionMarker, isCompactionMarker} from '../core/compaction-marker';
import {
  cellFirstSlot,
  cellSlotCount,
  slotToCell,
  SLOT_COUNTS,
  ORIGIN_SLOTS,
  QUINTANT_SHIFT,
  QUINTANT_SLOTS,
  RES30_TAG_BITS,
  RESOLUTION_TAGS,
  S_MASK,
  WORLD_SLOTS,
  WORLD_CELL
} from '../core/serialization';
import type {Cells, SlotRuns} from './types';

/**
 * Merge cells, in the given order, into sorted and disjoint slot runs in `out`.
 * With `checkOrder`, stop and return false at the first cell starting before
 * the one before it.
 */
function mergeCells(cells: Cells, out: SlotRuns, checkOrder: boolean): boolean {
  let previousLo = 0n;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (isCompactionMarker(cell)) continue;
    const lo = cellFirstSlot(cell);
    const hi = lo + cellSlotCount(cell);
    if (checkOrder && lo < previousLo) return false;
    previousLo = lo;
    // Drop earlier runs this one contains, then merge with the one before it
    let top = out.length - 2;
    while (top >= 0 && out[top] >= lo && out[top + 1] <= hi) {
      out.length = top;
      top -= 2;
    }
    appendSlotRun(out, lo, hi);
  }
  return true;
}

/** Whether a cell's ID lies inside its own slot run, so IDs sort like runs: res 1-29. */
function idInsideRun(cell: bigint): boolean {
  const tag = cell & -cell;
  return cell !== WORLD_CELL && tag !== RESOLUTION_TAGS[0] && (tag & RES30_TAG_BITS) === 0n;
}

/**
 * Cells sorted by a slot inside each cell's run: then disjoint runs come out
 * in order, and a run can only be preceded by runs it contains or that
 * contain it. Below res 30 and above res 0 the ID itself is such a slot, so a
 * native sort of the IDs does it.
 */
function sortCells(cells: Cells): Cells {
  let native = true;
  for (let i = 0; i < cells.length && native; i++) native = idInsideRun(cells[i]);
  if (native) return BigUint64Array.from(cells).sort();

  const starts = new Map<bigint, bigint>();
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    starts.set(cell, isCompactionMarker(cell) ? WORLD_SLOTS : cellFirstSlot(cell));
  }
  return Array.from(cells).sort((a, b) => {
    const la = starts.get(a)!;
    const lb = starts.get(b)!;
    return la < lb ? -1 : la > lb ? 1 : 0;
  });
}

/**
 * The slot runs covered by a set of cells, sorted and merged. Compaction
 * markers are skipped.
 *
 * Collections come sorted in curve order, so the cells are first merged as
 * given, checking the order as they go; only input found out of order is
 * sorted, and merged again.
 */
export function toSlotRuns(cells: Cells): SlotRuns {
  const runs: SlotRuns = [];
  if (!mergeCells(cells, runs, true)) {
    runs.length = 0;
    mergeCells(sortCells(cells), runs, false);
  }
  return runs;
}

/** Append a slot run [lo, hi) to sorted runs starting at or before lo, merging if they touch or overlap. */
export function appendSlotRun(runs: SlotRuns, lo: bigint, hi: bigint): void {
  const last = runs.length - 1;
  if (last > 0 && runs[last] >= lo) {
    if (hi > runs[last]) runs[last] = hi;
  } else {
    runs.push(lo, hi);
  }
}

/**
 * The coarsest cells covering the slot runs, in curve order. Runs built from
 * cells at resolution r or coarser are aligned to res-r cells, so no cell finer
 * than r is needed.
 */
export function slotRunsToCells(runs: SlotRuns): bigint[] {
  const out: bigint[] = [];
  for (let i = 0; i < runs.length; i += 2) {
    let lo = runs[i];
    const hi = runs[i + 1];
    while (lo < hi) {
      if (lo === 0n && hi === WORLD_SLOTS) {
        out.push(WORLD_CELL);
        break;
      }
      if ((lo & S_MASK) === 0n) {
        // Whole origins, then whole quintants
        if ((lo >> QUINTANT_SHIFT) % 5n === 0n && lo + ORIGIN_SLOTS <= hi) {
          out.push(slotToCell(lo, 0));
          lo += ORIGIN_SLOTS;
          continue;
        }
        if (lo + QUINTANT_SLOTS <= hi) {
          out.push(slotToCell(lo, 1));
          lo += QUINTANT_SLOTS;
          continue;
        }
      }
      // The coarsest Hilbert-level cell that starts at lo and fits: its span is
      // 4^k slots, at most the alignment of lo and the length of the run (the
      // float log2 can round up, so shrink until it fits)
      const offset = lo & S_MASK;
      let bits = offset === 0n ? 56 : Math.log2(Number(offset & -offset));
      const fit = Math.floor(Math.log2(Number(hi - lo)));
      if (fit < bits) bits = fit;
      let r = Math.max(2, Math.ceil((60 - bits) / 2));
      while (lo + SLOT_COUNTS[r] > hi) r++;
      out.push(slotToCell(lo, r));
      lo += SLOT_COUNTS[r];
    }
  }
  return out;
}

/** The coarsest cells covering slot runs, in curve order, then the compaction marker for `resolution`. */
export function slotRunsToCollection(runs: SlotRuns, resolution: number): BigUint64Array {
  const cells = slotRunsToCells(runs);
  if (resolution >= 0) cells.push(compactionMarker(resolution));
  return BigUint64Array.from(cells);
}

/**
 * Compact cells without appending a compaction marker: the coarsest cells covering
 * them, sorted in curve order. For internal use on intermediate results.
 */
export function compactCells(cells: Cells): bigint[] {
  return slotRunsToCells(toSlotRuns(cells));
}

/**
 * Compact cells, at resolution `resolution` or coarser, into a collection: the
 * coarsest cells covering them, sorted in curve order, then the compaction
 * marker for `resolution`. The resolution is given, so an empty fill still
 * records it.
 */
export function toCollection(cells: Cells, resolution: number): BigUint64Array {
  return slotRunsToCollection(toSlotRuns(cells), resolution);
}

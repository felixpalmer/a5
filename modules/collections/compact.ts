// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

/**
 * compact/uncompact for A5 DGGS. A compacted set of cells is a collection: its
 * cells sorted in curve order, then a compaction marker recording the resolution
 * they stand for (see ../core/compaction-marker).
 */

import {getNumChildren} from '../core/cell-info';
import {isCompactionMarker} from '../core/compaction-marker';
import {checkedResolution, cellToChildren} from '../core/serialization';
import {toCollection} from './slot-runs';
import {getCompactionResolution} from './resolution';
import type {Cells} from './types';

/**
 * Expand a set of cells to all their cells at its resolution: the resolution
 * of its compaction marker, or of its finest cell when it has none.
 *
 * **Ordering property**: If the input is sorted in curve order (as `compact`
 * returns it), the output is too. All children of a cell form a contiguous,
 * ordered block on the curve, so `children(A) < children(B)` whenever `A < B`.
 *
 * @throws If a value is neither an A5 cell ID nor a compaction marker
 */
export function uncompact(cells: Cells): BigUint64Array {
  const targetResolution = getCompactionResolution(cells);

  // First calculate how much space is needed
  let n = 0;
  const resolutions = new Int8Array(cells.length);
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (isCompactionMarker(cell)) continue;
    const resolution = checkedResolution(cell);
    resolutions[i] = resolution;
    n += getNumChildren(resolution, targetResolution);
  }

  // Write directly into pre-allocated array
  const result = new BigUint64Array(n);
  let offset = 0;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (isCompactionMarker(cell)) continue;
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
 * Compact a set of cells: replace every complete group of siblings by their
 * parent, recursively, and append a compaction marker recording the resolution of
 * the input's finest cell, which `uncompact` expands back to.
 *
 * @param cells - Array or TypedArray of cell indices to compact
 * @returns Compacted cells sorted in curve order, then the compaction marker
 * @throws If a value is neither an A5 cell ID nor a compaction marker
 */
export function compact(cells: Cells): BigUint64Array {
  return toCollection(cells, getCompactionResolution(cells));
}

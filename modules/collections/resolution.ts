// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {compactionMarkerResolution, isCompactionMarker} from '../core/compaction-marker';
import {RES30_TAG_BITS, RESOLUTION_TAGS, getResolution, MAX_RESOLUTION} from '../core/serialization';
import type {Cells} from './types';

/**
 * The resolution of a set of cells: the resolution of its compaction marker, or of
 * its finest cell when it has none. A compacted collection stands for all its
 * cells at this resolution. Returns -1 for an empty set (or the world cell).
 *
 * @param cells - Cells, as returned by `compact`, `polygonToCells` etc.
 * @returns Resolution (-1 to 30)
 */
export function getCompactionResolution(cells: Cells): number {
  // A collection ends in its compaction marker, which records the resolution
  const last = cells.length > 0 ? cells[cells.length - 1] : undefined;
  if (last !== undefined && isCompactionMarker(last)) return compactionMarkerResolution(last);

  // Otherwise the finest cell: finer cells have smaller resolution tags (the
  // lowest set bit), except at res 30, whose tags are recognised separately
  let finestTag = 0n;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    let tag: bigint;
    if (isCompactionMarker(cell)) {
      const resolution = compactionMarkerResolution(cell);
      if (resolution === MAX_RESOLUTION) return MAX_RESOLUTION;
      tag = RESOLUTION_TAGS[resolution];
    } else {
      tag = cell & -cell;
      if ((tag & RES30_TAG_BITS) !== 0n) return MAX_RESOLUTION;
    }
    if (tag !== 0n && (finestTag === 0n || tag < finestTag)) finestTag = tag;
  }
  return finestTag === 0n ? -1 : getResolution(finestTag);
}

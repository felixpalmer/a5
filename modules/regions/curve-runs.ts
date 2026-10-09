// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// Polygon fill by curve runs. Within a quintant consecutive cells on the curve
// are neighbors, or at most a step over one or two cells. So the band of
// boundary cells plus one ring of their neighbors splits each quintant's
// stretch of the curve (a range of slots) into runs that lie wholly inside or
// wholly outside the polygon: a step over the boundary would have to land in
// the band. One probe classifies a run, and an inside run is emitted whole, as
// a slot run (see coverings/slot-runs), so the interior costs O(boundary), not
// O(area).

import {cellToSpherical} from '../core/cell';
import {toCartesian} from '../core/coordinate-transforms';
import {
  cellFirstSlot,
  slotToCell,
  QUINTANT_SHIFT,
  S_MASK,
  SLOT_COUNTS,
  FIRST_HILBERT_RESOLUTION
} from '../core/serialization';
import {appendSlotRun} from '../coverings/slot-runs';
import type {SlotRuns} from '../coverings/types';
import {pointInPreparedPolygon} from '../geometry/prepared-polygon';
import {sToTriple, tripleFlavor, tripleToS} from '../lattice';
import {NEIGHBOR_DELTAS} from '../traversal/neighbors';
import {
  fillQuintantTables,
  forEachTripleNeighbor,
  tripleCellCenter,
  QUINTANT_ORIENTATION,
  QUINTANT_PREFIX,
  TRIPLE_QUINTANT_BY_ID_ORDER
} from '../traversal/triple-cells';
import type {Boundary} from './polygon-boundary';
import {boundaryNeighbors, emitsBoundaryCell, insideNextTo} from './polygon-boundary';

// Cells are ordered on the curve by the leaf slots they occupy (see core/serialization).

/** The slot of a cell given in triple space. */
function tripleSlot(
  originId: number,
  quintant: number,
  x: number,
  y: number,
  z: number,
  hilbertRes: number,
  unitShift: bigint
): bigint {
  const i = originId * 5 + quintant;
  return QUINTANT_PREFIX[i] | (tripleToS({x, y, z}, hilbertRes, QUINTANT_ORIENTATION[i])! << unitShift);
}

/**
 * Fill a polygon by curve runs, given its classified boundary and the boundary
 * cells as flat triples. `capHoldsQuintant` says whether the polygon might
 * swallow a quintant whole (one holding no band cells at all). Returns the
 * cells inside as sorted slot runs.
 */
export function fillByCurveRuns(
  boundary: Boundary,
  triples: number[],
  resolution: number,
  overlapping: boolean,
  capHoldsQuintant: boolean
): SlotRuns {
  const hilbertRes = resolution - FIRST_HILBERT_RESOLUTION + 1;
  const maxRow = (1 << hilbertRes) - 1;
  // One ring of neighbors (edge and vertex, across quintant edges too), edge neighbors first
  const {cells: ringCells, parents} = boundaryNeighbors(triples, [
    (b, c, visit) => forEachTripleNeighbor(b[c], b[c + 1], b[c + 2], b[c + 3], b[c + 4], maxRow, true, visit),
    (b, c, visit) => forEachTripleNeighbor(b[c], b[c + 1], b[c + 2], b[c + 3], b[c + 4], maxRow, false, visit)
  ]);

  fillQuintantTables();
  const unit = SLOT_COUNTS[resolution];
  const unitShift = BigInt(58 - 2 * hilbertRes);

  // Band slots carry two flags: EMIT (the cell is in the output) and RING. Below
  // resolution 30 a slot has zero low bits to hold them; at 30 a map does.
  const EMIT = 1;
  const RING = 2;
  const packed = unitShift >= 2n;
  const flagMap = new Map<bigint, number>();
  const withFlags = (slot: bigint, flags: number): bigint => {
    if (packed) return slot | BigInt(flags);
    flagMap.set(slot, flags);
    return slot;
  };
  const flagsOf = (slot: bigint): number => (packed ? Number(slot & 3n) : flagMap.get(slot)!);
  const slotOf = (slot: bigint): bigint => (packed ? slot & ~3n : slot);

  const nBoundary = boundary.cells.length;
  const nBand = nBoundary + ringCells.length / 5;
  const slots = new BigUint64Array(nBand);
  for (let i = 0; i < nBoundary; i++) {
    slots[i] = withFlags(cellFirstSlot(boundary.cells[i]), emitsBoundaryCell(boundary, i, overlapping) ? EMIT : 0);
  }
  // Ring cells by flagged slot (as their offset into ringCells), with their class
  const ringBySlot = new Map<bigint, number>();
  const ringInside = new Uint8Array(ringCells.length / 5);
  for (let c = 0, i = nBoundary; c < ringCells.length; c += 5, i++) {
    const r = ringCells;
    const center = toCartesian(tripleCellCenter(r[c], r[c + 1], r[c + 2], r[c + 3], r[c + 4], hilbertRes, maxRow));
    const inside = insideNextTo(boundary, center, parents[c / 5]);
    if (inside) ringInside[c / 5] = 1;
    const slot = withFlags(
      tripleSlot(r[c], r[c + 1], r[c + 2], r[c + 3], r[c + 4], hilbertRes, unitShift),
      inside ? EMIT | RING : RING
    );
    slots[i] = slot;
    ringBySlot.set(slot, c);
  }
  slots.sort();

  // The class of a run cell from a ring cell next to it on the curve, when the
  // two are lattice neighbors: any boundary cell near the run cell would have
  // put it in the ring, so nothing between them can cross the boundary.
  const classFromRing = (slot: bigint, ringSlot: bigint): boolean | undefined => {
    if ((flagsOf(ringSlot) & RING) === 0) return undefined;
    const c = ringBySlot.get(ringSlot)!;
    const q = Number(slot >> QUINTANT_SHIFT);
    const t = sToTriple((slot & S_MASK) >> unitShift, hilbertRes, QUINTANT_ORIENTATION[TRIPLE_QUINTANT_BY_ID_ORDER[q]]);
    const r = ringCells;
    const dx = t.x - r[c + 2];
    const dy = t.y - r[c + 3];
    const dz = t.z - r[c + 4];
    const deltas = NEIGHBOR_DELTAS[tripleFlavor({x: r[c + 2], y: r[c + 3], z: r[c + 4]}, maxRow)].all;
    for (let k = 0; k < deltas.length; k++) {
      const d = deltas[k];
      if (d.x === dx && d.y === dy && d.z === dz) return ringInside[c / 5] === 1;
    }
    return undefined;
  };

  // Walk each quintant's slots in curve order, emitting the inside band cells and
  // runs as they come, so the output is sorted.
  const out: SlotRuns = [];
  const probeRun = (lo: bigint, hi: bigint, prev: bigint, next: bigint) => {
    let inside = prev >= 0n ? classFromRing(lo, prev) : undefined;
    if (inside === undefined && next >= 0n) inside = classFromRing(hi - unit, next);
    if (inside === undefined) {
      inside = pointInPreparedPolygon(toCartesian(cellToSpherical(slotToCell(lo, resolution))), boundary.prep);
    }
    if (inside) appendSlotRun(out, lo, hi);
  };
  let i = 0;
  for (let q = 0; q < 60; q++) {
    // Skip straight to the next quintant holding band cells, unless whole ones may be inside
    if (!capHoldsQuintant) {
      if (i >= nBand) break;
      q = Number(slots[i] >> QUINTANT_SHIFT);
    }
    const qEnd = BigInt(q + 1) << QUINTANT_SHIFT;
    let cursor = BigInt(q) << QUINTANT_SHIFT;
    if (i >= nBand || slots[i] >= qEnd) {
      if (capHoldsQuintant) probeRun(cursor, qEnd, -1n, -1n);
      continue;
    }
    let prev = -1n;
    for (; i < nBand && slots[i] < qEnd; i++) {
      const flagged = slots[i];
      const slot = slotOf(flagged);
      if (slot > cursor) probeRun(cursor, slot, prev, flagged);
      if (flagsOf(flagged) & EMIT) appendSlotRun(out, slot, slot + unit);
      prev = flagged;
      cursor = slot + unit;
    }
    if (cursor < qEnd) probeRun(cursor, qEnd, prev, -1n);
  }

  return out;
}

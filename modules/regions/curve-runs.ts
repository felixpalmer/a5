// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// Polygon fill by curve runs. Within a quintant consecutive cells on the curve
// are neighbors, or at most a step over one or two cells. So the band of
// boundary cells plus one ring of their neighbors splits each quintant's
// stretch of the curve (a range of keys) into runs that lie wholly inside or
// wholly outside the polygon: a step over the boundary would have to land in
// the band. One probe classifies a run, and an inside run is emitted directly
// as the coarsest cells covering it, so the interior costs O(boundary), not
// O(area).

import {cellToSpherical} from '../core/cell';
import {toCartesian} from '../core/coordinate-transforms';
import {
  cellToParent,
  getResolution,
  getStride,
  isFirstChild,
  deserialize,
  serialize,
  FIRST_HILBERT_RESOLUTION,
  MAX_RESOLUTION
} from '../core/serialization';
import {compact} from '../core/compact';
import {origins, quintantToSegment, segmentToQuintant} from '../core/origin';
import {pointInPreparedPolygon} from '../geometry/prepared-polygon';
import type {Orientation} from '../lattice';
import {sToTriple, tripleFlavor, tripleToS} from '../lattice';
import {NEIGHBOR_DELTAS} from '../traversal/neighbors';
import {forEachTripleNeighbor, tripleCellCenter} from '../traversal/triple-cells';
import type {Boundary} from './polygon-boundary';
import {boundaryNeighbors, emitsBoundaryCell, insideNextTo} from './polygon-boundary';

// Cells are ordered on the curve by a 64-bit key: the 6-bit quintant (as in
// the ID's top bits) then S, left-aligned below it. Below resolution 30 that is
// the cell ID without its resolution marker; at resolution 30 S fills all 58
// bits. A cell at resolution r < 30 is its aligned key plus the marker.
const QUINTANT_SHIFT = 58n;
const S_MASK = (1n << QUINTANT_SHIFT) - 1n;

// Curve orientation of each quintant by its 6-bit key prefix, and the key
// prefix and orientation by triple quintant (origin.id * 5 + quintant).
// Filled on first use: calling quintantToSegment at module load leaves V8
// type feedback that slows serialize everywhere (see tripleCellToId).
const PREFIX_ORIENTATION: Orientation[] = [];
const TRIPLE_PREFIX: bigint[] = [];
const TRIPLE_ORIENTATION: Orientation[] = [];
function fillQuintantTables(): void {
  for (let q = 0; q < 60; q++) {
    const origin = origins[Math.floor(q / 5)];
    PREFIX_ORIENTATION.push(segmentToQuintant((q + origin.firstQuintant) % 5, origin).orientation);
  }
  for (const origin of origins) {
    for (let quintant = 0; quintant < 5; quintant++) {
      const {segment, orientation} = quintantToSegment(quintant, origin);
      const q = 5 * origin.id + ((segment - origin.firstQuintant + 5) % 5);
      TRIPLE_PREFIX.push(BigInt(q) << QUINTANT_SHIFT);
      TRIPLE_ORIENTATION.push(orientation);
    }
  }
}

/** The key of a cell given in triple space. */
function tripleKey(
  originId: number,
  quintant: number,
  x: number,
  y: number,
  z: number,
  hilbertRes: number,
  unitShift: bigint
): bigint {
  const i = originId * 5 + quintant;
  return TRIPLE_PREFIX[i] | (tripleToS({x, y, z}, hilbertRes, TRIPLE_ORIENTATION[i])! << unitShift);
}

function markerBit(resolution: number): bigint {
  return resolution === 1 ? 1n << 56n : 1n << BigInt(59 - 2 * resolution);
}

function cellToKey(cell: bigint, resolution: number): bigint {
  if (resolution < MAX_RESOLUTION) return cell - markerBit(resolution);
  const {origin, segment, S} = deserialize(cell);
  const q = 5 * origin.id + ((segment - origin.firstQuintant + 5) % 5);
  return (BigInt(q) << QUINTANT_SHIFT) | S;
}

function keyToCell(key: bigint, resolution: number): bigint {
  if (resolution < MAX_RESOLUTION) return key + markerBit(resolution);
  const q = Number(key >> QUINTANT_SHIFT);
  const origin = origins[Math.floor(q / 5)];
  return serialize({origin, segment: (q + origin.firstQuintant) % 5, S: key & S_MASK, resolution});
}

/**
 * Append the cells covering the key range [lo, hi) at `resolution`, as the
 * coarsest aligned blocks (a block of 4^k cells is their resolution - k parent).
 */
function emitRange(lo: bigint, hi: bigint, resolution: number, out: bigint[]): void {
  const hilbertRes = resolution - FIRST_HILBERT_RESOLUTION + 1;
  const unitShift = 58 - 2 * hilbertRes;
  while (lo < hi) {
    let k = 0;
    while (k < hilbertRes) {
      const size = 1n << BigInt(unitShift + 2 * (k + 1));
      if ((lo & (size - 1n)) !== 0n || lo + size > hi) break;
      k++;
    }
    out.push(keyToCell(lo, resolution - k));
    lo += 1n << BigInt(unitShift + 2 * k);
  }
}

/**
 * Compact cells that are already sorted and disjoint, in one pass: a stack
 * whose top is merged into its parent whenever it ends in a full sibling group.
 */
function compactSorted(cells: bigint[]): BigUint64Array {
  const stack: bigint[] = [];
  for (let i = 0; i < cells.length; i++) {
    stack.push(cells[i]);
    for (;;) {
      const top = stack.length - 1;
      const resolution = getResolution(stack[top]);
      if (resolution < 0) break;
      const n = resolution >= FIRST_HILBERT_RESOLUTION ? 4 : resolution === 0 ? 12 : 5;
      if (stack.length < n) break;
      const first = stack[top - n + 1];
      if (!isFirstChild(first, resolution)) break;
      const stride = getStride(resolution);
      if (stack[top] !== first + BigInt(n - 1) * stride) break;
      let complete = true;
      for (let j = 1; j < n - 1; j++) {
        if (stack[top - n + 1 + j] !== first + BigInt(j) * stride) {
          complete = false;
          break;
        }
      }
      if (!complete) break;
      stack.length -= n;
      stack.push(cellToParent(first));
    }
  }
  return BigUint64Array.from(stack);
}

/**
 * Fill a polygon by curve runs, given its classified boundary and the boundary
 * cells as flat triples. `capHoldsQuintant` says whether the polygon might
 * swallow a quintant whole (one holding no band cells at all).
 */
export function fillByCurveRuns(
  boundary: Boundary,
  triples: number[],
  resolution: number,
  overlapping: boolean,
  capHoldsQuintant: boolean
): BigUint64Array {
  const hilbertRes = resolution - FIRST_HILBERT_RESOLUTION + 1;
  const maxRow = (1 << hilbertRes) - 1;
  // One ring of neighbors (edge and vertex, across quintant edges too), edge neighbors first
  const {cells: ringCells, parents} = boundaryNeighbors(triples, [
    (b, c, visit) => forEachTripleNeighbor(b[c], b[c + 1], b[c + 2], b[c + 3], b[c + 4], maxRow, true, visit),
    (b, c, visit) => forEachTripleNeighbor(b[c], b[c + 1], b[c + 2], b[c + 3], b[c + 4], maxRow, false, visit)
  ]);

  if (TRIPLE_PREFIX.length === 0) fillQuintantTables();
  const unitShift = BigInt(58 - 2 * hilbertRes);
  const unit = 1n << unitShift;

  // Band keys carry two flags: EMIT (the cell is in the output) and RING. Below
  // resolution 30 a key has zero low bits to hold them; at 30 a map does.
  const EMIT = 1;
  const RING = 2;
  const packed = unitShift >= 2n;
  const flagMap = new Map<bigint, number>();
  const withFlags = (key: bigint, flags: number): bigint => {
    if (packed) return key | BigInt(flags);
    flagMap.set(key, flags);
    return key;
  };
  const flagsOf = (key: bigint): number => (packed ? Number(key & 3n) : flagMap.get(key)!);
  const keyOf = (key: bigint): bigint => (packed ? key & ~3n : key);

  const nBoundary = boundary.cells.length;
  const nBand = nBoundary + ringCells.length / 5;
  const keys = new BigUint64Array(nBand);
  for (let i = 0; i < nBoundary; i++) {
    keys[i] = withFlags(
      cellToKey(boundary.cells[i], resolution),
      emitsBoundaryCell(boundary, i, overlapping) ? EMIT : 0
    );
  }
  // Ring cells by flagged key (as their offset into ringCells), with their class
  const ringByKey = new Map<bigint, number>();
  const ringInside = new Uint8Array(ringCells.length / 5);
  for (let c = 0, i = nBoundary; c < ringCells.length; c += 5, i++) {
    const r = ringCells;
    const center = toCartesian(tripleCellCenter(r[c], r[c + 1], r[c + 2], r[c + 3], r[c + 4], hilbertRes, maxRow));
    const inside = insideNextTo(boundary, center, parents[c / 5]);
    if (inside) ringInside[c / 5] = 1;
    const key = withFlags(
      tripleKey(r[c], r[c + 1], r[c + 2], r[c + 3], r[c + 4], hilbertRes, unitShift),
      inside ? EMIT | RING : RING
    );
    keys[i] = key;
    ringByKey.set(key, c);
  }
  keys.sort();

  // The class of a run cell from a ring cell next to it on the curve, when the
  // two are lattice neighbors: any boundary cell near the run cell would have
  // put it in the ring, so nothing between them can cross the boundary.
  const classFromRing = (key: bigint, ringKey: bigint): boolean | undefined => {
    if ((flagsOf(ringKey) & RING) === 0) return undefined;
    const c = ringByKey.get(ringKey)!;
    const q = Number(key >> QUINTANT_SHIFT);
    const t = sToTriple((key & S_MASK) >> unitShift, hilbertRes, PREFIX_ORIENTATION[q]);
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

  // Walk each quintant's keys in curve order, emitting the inside band cells and
  // runs as they come, so the output is sorted.
  const out: bigint[] = [];
  const probeRun = (lo: bigint, hi: bigint, prev: bigint, next: bigint) => {
    let inside = prev >= 0n ? classFromRing(lo, prev) : undefined;
    if (inside === undefined && next >= 0n) inside = classFromRing(hi - unit, next);
    if (inside === undefined) {
      inside = pointInPreparedPolygon(toCartesian(cellToSpherical(keyToCell(lo, resolution))), boundary.prep);
    }
    if (inside) emitRange(lo, hi, resolution, out);
  };
  let i = 0;
  for (let q = 0; q < 60; q++) {
    // Skip straight to the next quintant holding band cells, unless whole ones may be inside
    if (!capHoldsQuintant) {
      if (i >= nBand) break;
      q = Number(keys[i] >> QUINTANT_SHIFT);
    }
    const qEnd = BigInt(q + 1) << QUINTANT_SHIFT;
    let cursor = BigInt(q) << QUINTANT_SHIFT;
    if (i >= nBand || keys[i] >= qEnd) {
      if (capHoldsQuintant) probeRun(cursor, qEnd, -1n, -1n);
      continue;
    }
    let prev = -1n;
    for (; i < nBand && keys[i] < qEnd; i++) {
      const flagged = keys[i];
      const key = keyOf(flagged);
      if (key > cursor) probeRun(cursor, key, prev, flagged);
      if (flagsOf(flagged) & EMIT) out.push(keyToCell(key, resolution));
      prev = flagged;
      cursor = key + unit;
    }
    if (cursor < qEnd) probeRun(cursor, qEnd, prev, -1n);
  }

  // Resolution 30 IDs don't sort like their keys (the quintant field varies in width)
  return resolution === MAX_RESOLUTION ? compact(out) : compactSorted(out);
}

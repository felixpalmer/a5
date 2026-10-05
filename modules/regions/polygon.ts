// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type {LonLat, Cartesian} from '../core/coordinate-systems';
import {lonLatToCell, sphericalToCell, cellToSpherical} from '../core/cell';
import {fromLonLat, toCartesian, toSpherical} from '../core/coordinate-transforms';
import {
  cellToChildren,
  cellToParent,
  getResolution,
  getStride,
  isFirstChild,
  deserialize,
  serialize,
  FIRST_HILBERT_RESOLUTION,
  MAX_RESOLUTION,
  WORLD_CELL
} from '../core/serialization';
import {compact} from '../core/compact';
import {ringWindingSign} from '../geometry/spherical-polygon';
import type {PreparedPolygon} from '../geometry/prepared-polygon';
import {preparePolygon, pointInPreparedPolygon} from '../geometry/prepared-polygon';
import {estimateCellRadius} from '../traversal/cap';
import {sampleGreatCircleArc} from '../utils/great-circle';
import {origins, quintantToSegment, segmentToQuintant} from '../core/origin';
import type {Orientation} from '../lattice';
import {sToTriple, tripleFlavor, tripleToS} from '../lattice';
import {NEIGHBOR_DELTAS} from '../traversal/neighbors';
import {cellIdsToTriples, forEachTripleNeighbor, tripleCellCenter, tripleCellKey} from '../traversal/triple-cells';

/**
 * Maps each boundary cell to the indices of the ring segments that produced it.
 * Segment indices are global across rings (outer ring first, then holes).
 * Used by `classifyBoundaryCells` to short-circuit PIP via segment-side dot
 * products, and to classify ring cells locally.
 */
type SegmentMap = Map<bigint, number[]>;

/**
 * Dense-sample boundary cells along every closed ring (outer + holes) at
 * `cellRadius * 0.4` spacing, calling `sphericalToCell` per sample.
 */
function denseSampleBoundary(
  rings: LonLat[][],
  ringVecsList: Cartesian[][],
  resolution: number
): {boundaryCells: bigint[]; boundarySet: Set<bigint>; segmentMap: SegmentMap} {
  const boundaryCells: bigint[] = [];
  const boundarySet = new Set<bigint>();
  const segmentMap: SegmentMap = new Map();
  const cellRadius = estimateCellRadius(resolution);
  const sampleInterval = cellRadius * 0.4;

  const recordCell = (cell: bigint, segIdx: number) => {
    if (!boundarySet.has(cell)) {
      boundarySet.add(cell);
      boundaryCells.push(cell);
    }
    const existing = segmentMap.get(cell);
    if (existing) {
      if (existing[existing.length - 1] !== segIdx) existing.push(segIdx);
    } else {
      segmentMap.set(cell, [segIdx]);
    }
  };

  let segOffset = 0;
  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    const ringVecs = ringVecsList[r];

    const vertexCells: bigint[] = new Array(ring.length);
    for (let i = 0; i < ring.length; i++) {
      vertexCells[i] = lonLatToCell(ring[i], resolution);
    }

    for (let i = 0; i < ring.length; i++) {
      const nextI = (i + 1) % ring.length;
      recordCell(vertexCells[i], segOffset + i);

      // Skip the lonLat round-trip: samples are authalic-Cartesian already.
      const samples = sampleGreatCircleArc(ringVecs[i], ringVecs[nextI], sampleInterval);
      for (const s of samples) {
        recordCell(sphericalToCell(toSpherical(s), resolution), segOffset + i);
      }
      recordCell(vertexCells[nextI], segOffset + i);
    }
    segOffset += ring.length;
  }

  return {boundaryCells, boundarySet, segmentMap};
}

/**
 * Whether `p` lies in the lune of the segment a->b (normal `n` = a × b): its
 * projection onto the great circle falls between a and b.
 */
function projectsOntoSegment(p: Cartesian, a: Cartesian, b: Cartesian, n: Cartesian): boolean {
  // n × a points along the arc from a towards b, b × n from b back towards a
  const fromA =
    p[0] * (n[1] * a[2] - n[2] * a[1]) + p[1] * (n[2] * a[0] - n[0] * a[2]) + p[2] * (n[0] * a[1] - n[1] * a[0]);
  const fromB =
    p[0] * (b[1] * n[2] - b[2] * n[1]) + p[1] * (b[2] * n[0] - b[0] * n[2]) + p[2] * (b[0] * n[1] - b[1] * n[0]);
  return fromA > 0 && fromB > 0;
}

/**
 * Classify boundary cells by whether their center is inside the polygon.
 *
 * For each cell we know which ring segment(s) sampled it. When all of those
 * segments place the cell on the same side (cheap signed-dot test), that
 * decides it. When they disagree (vertex / concave corner) or the cell wasn't
 * recorded, fall back to full PIP. Returns the centers too, for reuse.
 */
function classifyBoundaryCells(
  boundaryCells: bigint[],
  segmentMap: SegmentMap,
  segStarts: Cartesian[],
  segEnds: Cartesian[],
  segNormals: Cartesian[],
  segSigns: number[],
  prep: PreparedPolygon
): {inside: Uint8Array; centers: Cartesian[]} {
  const inside = new Uint8Array(boundaryCells.length);
  const centers: Cartesian[] = new Array(boundaryCells.length);
  for (let c = 0; c < boundaryCells.length; c++) {
    const cv = toCartesian(cellToSpherical(boundaryCells[c]));
    centers[c] = cv;
    const segments = segmentMap.get(boundaryCells[c]);
    if (!segments) {
      inside[c] = pointInPreparedPolygon(cv, prep) ? 1 : 0;
      continue;
    }
    let allInside = true;
    let anyInside = false;
    let ambiguous = false;
    for (const segIdx of segments) {
      const n = segNormals[segIdx];
      const dot = n[0] * cv[0] + n[1] * cv[1] + n[2] * cv[2];
      if (Math.abs(dot) < 1e-14) {
        ambiguous = true;
        break;
      } // on segment within float epsilon
      // The side of the segment's great circle only decides when the center
      // projects onto the segment itself, not beyond one of its endpoints
      if (!projectsOntoSegment(cv, segStarts[segIdx], segEnds[segIdx], n)) {
        ambiguous = true;
        break;
      }
      if (dot * segSigns[segIdx] > 0) anyInside = true;
      else allInside = false;
    }
    if (ambiguous || (anyInside && !allInside)) {
      inside[c] = pointInPreparedPolygon(cv, prep) ? 1 : 0;
    } else {
      inside[c] = allInside ? 1 : 0;
    }
  }
  return {inside, centers};
}

const CROSSING_EPS = 1e-14;

/**
 * Parity of the crossings of the short arc p->q with the given ring segments
 * (proper crossings, by the signs of four triple products), or undefined on a
 * near-degenerate sign.
 */
function arcCrossingParity(
  p: Cartesian,
  q: Cartesian,
  segments: number[],
  segStarts: Cartesian[],
  segEnds: Cartesian[],
  segNormals: Cartesian[]
): boolean | undefined {
  const abx = p[1] * q[2] - p[2] * q[1];
  const aby = p[2] * q[0] - p[0] * q[2];
  const abz = p[0] * q[1] - p[1] * q[0];
  let odd = false;
  for (let k = 0; k < segments.length; k++) {
    const seg = segments[k];
    const c = segStarts[seg];
    const d = segEnds[seg];
    const acb = -(abx * c[0] + aby * c[1] + abz * c[2]);
    const bda = abx * d[0] + aby * d[1] + abz * d[2];
    if (Math.abs(acb) < CROSSING_EPS || Math.abs(bda) < CROSSING_EPS) return undefined;
    if (acb * bda < 0) continue;
    const cd = segNormals[seg];
    const cbd = -(cd[0] * q[0] + cd[1] * q[1] + cd[2] * q[2]);
    const dac = cd[0] * p[0] + cd[1] * p[1] + cd[2] * p[2];
    if (Math.abs(cbd) < CROSSING_EPS || Math.abs(dac) < CROSSING_EPS) return undefined;
    if (acb * cbd > 0 && acb * dac > 0) odd = !odd;
  }
  return odd;
}

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
 * The ring of neighbors (edge and vertex, across quintant edges too) around
 * the boundary cells (flat triples). Each ring cell records a boundary cell
 * next to it (`parents`, an index into the boundary): one it shares an edge
 * with when there is one, as edge neighbors are visited first. The arc between
 * their centers then crosses no other cell holding boundary samples: a ring
 * cell found by a vertex has no boundary cell across any of its edges, which
 * covers every other cell around that vertex.
 */
function growRing(boundary: number[], maxRow: number): {ring: number[]; parents: number[]} {
  const seen = new Set<number>();
  for (let c = 0; c < boundary.length; c += 5) {
    seen.add(tripleCellKey(boundary[c], boundary[c + 1], boundary[c + 2], boundary[c + 3], boundary[c + 4]));
  }
  const ring: number[] = [];
  const parents: number[] = [];
  let parent = 0;
  const visit = (originId: number, quintant: number, x: number, y: number, z: number) => {
    const key = tripleCellKey(originId, quintant, x, y, z);
    if (seen.has(key)) return;
    seen.add(key);
    ring.push(originId, quintant, x, y, z);
    parents.push(parent);
  };
  for (const edgeOnly of [true, false]) {
    for (let c = 0; c < boundary.length; c += 5) {
      const b = boundary;
      parent = c / 5;
      forEachTripleNeighbor(b[c], b[c + 1], b[c + 2], b[c + 3], b[c + 4], maxRow, edgeOnly, visit);
    }
  }
  return {ring, parents};
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
 * How a cell is judged to belong to the polygon.
 * - `'center'`: a cell is included iff its center lies inside the polygon.
 * - `'overlapping'`: additionally include every cell that overlaps the polygon
 *   boundary, giving gap-free coverage (a superset of `'center'`).
 */
export type PolygonContainment = 'center' | 'overlapping';

type PolygonToCellsOptions = {
  /**
   * Which cells to include relative to the polygon.
   * @default 'center'
   */
  containment?: PolygonContainment;
};

/**
 * Find all cells within a polygon. The result is compacted — use `uncompact`
 * to expand to the input resolution.
 *
 * @param polygon - Either a single ring of [longitude, latitude] vertices, or
 *   GeoJSON-style rings `[outer, ...holes]` where cells inside a hole are
 *   excluded. Rings may be open or closed (GeoJSON-style, first vertex
 *   repeated at the end) — closure is automatic either way. Holes with fewer
 *   than 3 distinct vertices are ignored.
 * @param resolution - Target resolution (0..30)
 * @param options - `containment` selects `'center'` (default, cell center
 *   inside the polygon) or `'overlapping'` (any cell touching the polygon, for
 *   gap-free coverage).
 * @returns Sorted, compacted BigUint64Array of cell IDs
 */
export function polygonToCells(
  polygon: LonLat[] | LonLat[][],
  resolution: number,
  {containment = 'center'}: PolygonToCellsOptions = {}
): BigUint64Array {
  // Normalize: a flat ring is shorthand for a polygon with no holes.
  const isNested = polygon.length > 0 && typeof (polygon[0] as LonLat | LonLat[])[0] !== 'number';
  const inputRings = (isNested ? polygon : [polygon]) as LonLat[][];

  // GeoJSON rings repeat the first vertex at the end — drop the duplicate.
  const stripClosing = (ring: LonLat[]): LonLat[] => {
    const last = ring.length - 1;
    return last > 0 && ring[0][0] === ring[last][0] && ring[0][1] === ring[last][1] ? ring.slice(0, -1) : ring;
  };

  if (inputRings.length === 0) return new BigUint64Array(0);
  const outer = stripClosing(inputRings[0]);
  if (outer.length < 3) return new BigUint64Array(0);
  const rings: LonLat[][] = [outer];
  for (let r = 1; r < inputRings.length; r++) {
    const hole = stripClosing(inputRings[r]);
    if (hole.length >= 3) rings.push(hole);
  }

  // Authalic-sphere ring vectors — A5's internal sphere, so cell centers
  // compare directly with no geodetic↔authalic round-trip.
  const ringVecsList: Cartesian[][] = new Array(rings.length);
  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    const ringVecs: Cartesian[] = new Array(ring.length);
    for (let i = 0; i < ring.length; i++) {
      ringVecs[i] = toCartesian(fromLonLat(ring[i]));
    }
    ringVecsList[r] = ringVecs;
  }

  const prep = preparePolygon(ringVecsList);

  const {boundaryCells, boundarySet, segmentMap} = denseSampleBoundary(rings, ringVecsList, resolution);

  // Res 30 covers only quintants 0-41 (elsewhere A5 answers at res 29, see
  // serialize), so a polygon reaching past them is filled at res 29: mixing the
  // two lattices would leave the fill without a consistent grid.
  if (resolution === MAX_RESOLUTION && boundaryCells.some(cell => getResolution(cell) !== resolution)) {
    return polygonToCells(polygon, resolution - 1, {containment});
  }

  // Flattened per-segment endpoints, normals and interior-side signs, indexed
  // like the segment map. The polygon interior lies on the *outside* of a hole
  // ring, so hole segments get the opposite sign.
  const segStarts: Cartesian[] = [];
  const segEnds: Cartesian[] = [];
  const segNormals: Cartesian[] = [];
  const segSigns: number[] = [];
  for (let r = 0; r < rings.length; r++) {
    const sign = (r === 0 ? 1 : -1) * ringWindingSign(ringVecsList[r]);
    const vecs = ringVecsList[r];
    const normals = prep.ringNormals[r];
    for (let i = 0; i < normals.length; i++) {
      segStarts.push(vecs[i]);
      segEnds.push(vecs[(i + 1) % vecs.length]);
      segNormals.push(normals[i]);
      segSigns.push(sign);
    }
  }
  const {inside: boundaryInside, centers: boundaryCenters} = classifyBoundaryCells(
    boundaryCells,
    segmentMap,
    segStarts,
    segEnds,
    segNormals,
    segSigns,
    prep
  );

  // In 'overlapping' mode every densely-sampled boundary cell contains a point
  // on the polygon boundary, so it overlaps the polygon — keep them all. In
  // 'center' mode keep those whose center lies inside.
  const emitBoundary = (c: number) => containment === 'overlapping' || boundaryInside[c] === 1;

  // Resolutions 0 and 1 have no lattice (a quintant is a single cell): every
  // cell off the boundary is in or out by its center, and there are at most 60
  // of them.
  if (resolution < FIRST_HILBERT_RESOLUTION) {
    const out: bigint[] = [];
    for (let c = 0; c < boundaryCells.length; c++) if (emitBoundary(c)) out.push(boundaryCells[c]);
    for (const cell of cellToChildren(WORLD_CELL, resolution)) {
      if (!boundarySet.has(cell) && pointInPreparedPolygon(toCartesian(cellToSpherical(cell)), prep)) out.push(cell);
    }
    return compact(out);
  }

  // The rest relies on the curve. Within a quintant consecutive cells are
  // neighbors, or at most a step over one or two cells. So the band of boundary
  // cells plus one ring of their neighbors splits each quintant's stretch of the
  // curve (a range of keys) into runs that lie wholly inside or wholly outside
  // the polygon: a step over the boundary would have to land in the band. One
  // probe classifies a run, and an inside run is emitted directly as the
  // coarsest cells covering it, so the interior costs O(boundary), not O(area).
  const hilbertRes = resolution - FIRST_HILBERT_RESOLUTION + 1;
  const maxRow = (1 << hilbertRes) - 1;
  const boundary = cellIdsToTriples(boundaryCells);
  const {ring: ringCells, parents} = growRing(boundary, maxRow);

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

  const nBoundary = boundaryCells.length;
  const nBand = nBoundary + ringCells.length / 5;
  const keys = new BigUint64Array(nBand);
  for (let i = 0; i < nBoundary; i++) {
    keys[i] = withFlags(cellToKey(boundaryCells[i], resolution), emitBoundary(i) ? EMIT : 0);
  }
  // Ring cells by flagged key (as their offset into ringCells), with their class
  const ringByKey = new Map<bigint, number>();
  const ringInside = new Uint8Array(ringCells.length / 5);
  for (let c = 0, i = nBoundary; c < ringCells.length; c += 5, i++) {
    const r = ringCells;
    const center = toCartesian(tripleCellCenter(r[c], r[c + 1], r[c + 2], r[c + 3], r[c + 4], hilbertRes, maxRow));
    // Locally: the parent's class, flipped by each ring segment crossed on the
    // way (full PIP only on a near-degenerate crossing)
    const parent = parents[i - nBoundary];
    const segments = segmentMap.get(boundaryCells[parent])!;
    const odd = arcCrossingParity(center, boundaryCenters[parent], segments, segStarts, segEnds, segNormals);
    const inside = odd === undefined ? pointInPreparedPolygon(center, prep) : (boundaryInside[parent] === 1) !== odd;
    if (inside) ringInside[c / 5] = 1;
    const key = withFlags(
      tripleKey(r[c], r[c + 1], r[c + 2], r[c + 3], r[c + 4], hilbertRes, unitShift),
      inside ? EMIT | RING : RING
    );
    keys[i] = key;
    ringByKey.set(key, c);
  }
  keys.sort();

  // A quintant without band cells is wholly inside or outside; it can only be
  // inside when the polygon's bounding cap holds a quintant's area (4π/60)
  const capHoldsQuintant = 2 * Math.PI * (1 - prep.cap.minDot) >= (4 * Math.PI) / 60;

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
      inside = pointInPreparedPolygon(toCartesian(cellToSpherical(keyToCell(lo, resolution))), prep);
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

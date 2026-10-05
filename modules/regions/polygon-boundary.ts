// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// The boundary of a polygon in cells: sampled densely along every ring,
// classified by whether each cell's center is inside, and used to classify the
// cells next to it without a full point-in-polygon test.

import type {LonLat, Cartesian} from '../core/coordinate-systems';
import {lonLatToCell, sphericalToCell, cellToSpherical} from '../core/cell';
import {toCartesian, toSpherical} from '../core/coordinate-transforms';
import {ringWindingSign, sphericalTriangleArea} from '../geometry/spherical-polygon';
import type {PreparedPolygon} from '../geometry/prepared-polygon';
import {pointInPreparedPolygon} from '../geometry/prepared-polygon';
import {estimateCellRadius} from '../traversal/cap';
import {tripleCellKey} from '../traversal/triple-cells';
import type {TripleCellVisitor} from '../traversal/triple-cells';
import {sampleGreatCircleArc} from '../utils/great-circle';

/**
 * Maps each boundary cell to the indices of the ring segments that produced it.
 * Segment indices are global across rings (outer ring first, then holes).
 */
type SegmentMap = Map<bigint, number[]>;

/**
 * Every ring segment, flattened across rings and indexed like the segment map:
 * endpoints, great-circle normal, and the side the polygon interior lies on.
 */
interface Segments {
  starts: Cartesian[];
  ends: Cartesian[];
  normals: Cartesian[];
  signs: number[];
}

/** The polygon's boundary cells, classified, with what's needed to classify their neighbors. */
export interface Boundary {
  /** Cell IDs in the order they were sampled */
  cells: bigint[];
  set: Set<bigint>;
  /** 1 when the cell's center is inside the polygon, by index into `cells` */
  inside: Uint8Array;
  /** Cell centers, by index into `cells` */
  centers: Cartesian[];
  segmentMap: SegmentMap;
  segments: Segments;
  prep: PreparedPolygon;
}

/**
 * Dense-sample boundary cells along every closed ring (outer + holes) at
 * `cellRadius * 0.4` spacing, calling `sphericalToCell` per sample.
 */
export function sampleBoundary(
  rings: LonLat[][],
  ringVecsList: Cartesian[][],
  resolution: number
): {cells: bigint[]; set: Set<bigint>; segmentMap: SegmentMap} {
  const cells: bigint[] = [];
  const set = new Set<bigint>();
  const segmentMap: SegmentMap = new Map();
  const cellRadius = estimateCellRadius(resolution);
  const sampleInterval = cellRadius * 0.4;

  const recordCell = (cell: bigint, segIdx: number) => {
    if (!set.has(cell)) {
      set.add(cell);
      cells.push(cell);
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

  return {cells, set, segmentMap};
}

/**
 * The polygon's ring segments, flattened. The polygon interior lies on the
 * *outside* of a hole ring, so hole segments get the opposite sign.
 */
function ringSegments(ringVecsList: Cartesian[][], prep: PreparedPolygon): Segments {
  const segments: Segments = {starts: [], ends: [], normals: [], signs: []};
  for (let r = 0; r < ringVecsList.length; r++) {
    const sign = (r === 0 ? 1 : -1) * ringWindingSign(ringVecsList[r]);
    const vecs = ringVecsList[r];
    const normals = prep.ringNormals[r];
    for (let i = 0; i < normals.length; i++) {
      segments.starts.push(vecs[i]);
      segments.ends.push(vecs[(i + 1) % vecs.length]);
      segments.normals.push(normals[i]);
      segments.signs.push(sign);
    }
  }
  return segments;
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
 * Classify the sampled boundary cells by whether their center is inside the
 * polygon.
 *
 * For each cell we know which ring segment(s) sampled it. When all of those
 * segments place the cell on the same side (cheap signed-dot test), that
 * decides it. When they disagree (vertex / concave corner) or the cell wasn't
 * recorded, fall back to full PIP.
 */
export function classifyBoundary(
  sampled: {cells: bigint[]; set: Set<bigint>; segmentMap: SegmentMap},
  ringVecsList: Cartesian[][],
  prep: PreparedPolygon
): Boundary {
  const {cells, segmentMap} = sampled;
  const segments = ringSegments(ringVecsList, prep);
  const inside = new Uint8Array(cells.length);
  const centers: Cartesian[] = new Array(cells.length);
  for (let c = 0; c < cells.length; c++) {
    const cv = toCartesian(cellToSpherical(cells[c]));
    centers[c] = cv;
    const segs = segmentMap.get(cells[c]);
    if (!segs) {
      inside[c] = pointInPreparedPolygon(cv, prep) ? 1 : 0;
      continue;
    }
    let allInside = true;
    let anyInside = false;
    let ambiguous = false;
    for (const segIdx of segs) {
      const n = segments.normals[segIdx];
      const dot = n[0] * cv[0] + n[1] * cv[1] + n[2] * cv[2];
      if (Math.abs(dot) < 1e-14) {
        ambiguous = true;
        break;
      } // on segment within float epsilon
      // The side of the segment's great circle only decides when the center
      // projects onto the segment itself, not beyond one of its endpoints
      if (!projectsOntoSegment(cv, segments.starts[segIdx], segments.ends[segIdx], n)) {
        ambiguous = true;
        break;
      }
      if (dot * segments.signs[segIdx] > 0) anyInside = true;
      else allInside = false;
    }
    if (ambiguous || (anyInside && !allInside)) {
      inside[c] = pointInPreparedPolygon(cv, prep) ? 1 : 0;
    } else {
      inside[c] = allInside ? 1 : 0;
    }
  }
  return {...sampled, inside, centers, segments, prep};
}

/**
 * The boundary cells in the output. In 'overlapping' mode every densely-sampled
 * boundary cell contains a point on the polygon boundary, so it overlaps the
 * polygon — keep them all. In 'center' mode keep those whose center lies inside.
 */
export function emitsBoundaryCell(boundary: Boundary, c: number, overlapping: boolean): boolean {
  return overlapping || boundary.inside[c] === 1;
}

/** The boundary cells in the output (see `emitsBoundaryCell`), as a new array. */
export function boundaryOutput(boundary: Boundary, overlapping: boolean): bigint[] {
  const out: bigint[] = [];
  for (let c = 0; c < boundary.cells.length; c++) {
    if (emitsBoundaryCell(boundary, c, overlapping)) out.push(boundary.cells[c]);
  }
  return out;
}

const CROSSING_EPS = 1e-14;

/**
 * Parity of the crossings of the short arc p->q with the given ring segments
 * (proper crossings, by the signs of four triple products), or undefined on a
 * near-degenerate sign.
 */
function arcCrossingParity(p: Cartesian, q: Cartesian, segIdxs: number[], segments: Segments): boolean | undefined {
  const abx = p[1] * q[2] - p[2] * q[1];
  const aby = p[2] * q[0] - p[0] * q[2];
  const abz = p[0] * q[1] - p[1] * q[0];
  let odd = false;
  for (let k = 0; k < segIdxs.length; k++) {
    const seg = segIdxs[k];
    const c = segments.starts[seg];
    const d = segments.ends[seg];
    const acb = -(abx * c[0] + aby * c[1] + abz * c[2]);
    const bda = abx * d[0] + aby * d[1] + abz * d[2];
    if (Math.abs(acb) < CROSSING_EPS || Math.abs(bda) < CROSSING_EPS) return undefined;
    if (acb * bda < 0) continue;
    const cd = segments.normals[seg];
    const cbd = -(cd[0] * q[0] + cd[1] * q[1] + cd[2] * q[2]);
    const dac = cd[0] * p[0] + cd[1] * p[1] + cd[2] * p[2];
    if (Math.abs(cbd) < CROSSING_EPS || Math.abs(dac) < CROSSING_EPS) return undefined;
    if (acb * cbd > 0 && acb * dac > 0) odd = !odd;
  }
  return odd;
}

/**
 * Whether a point next to boundary cell `parent` (see `boundaryNeighbors`) is
 * inside the polygon: the parent's class, flipped by each of its ring segments
 * crossed on the way. Full PIP only on a near-degenerate crossing.
 */
export function insideNextTo(boundary: Boundary, center: Cartesian, parent: number): boolean {
  const segIdxs = boundary.segmentMap.get(boundary.cells[parent])!;
  const odd = arcCrossingParity(center, boundary.centers[parent], segIdxs, boundary.segments);
  return odd === undefined ? pointInPreparedPolygon(center, boundary.prep) : (boundary.inside[parent] === 1) !== odd;
}

/** Calls `visit` for neighbors of the cell at offset `c` of a flat triple array. */
export type NeighborWalk = (cells: number[], c: number, visit: TripleCellVisitor) => void;

/**
 * The cells next to the boundary (flat triples), found by `walks` in turn, each
 * with the boundary cell it was first found from (`parents`, an index into the
 * boundary). Listing edge-neighbor walks first gives every cell an edge-sharing
 * parent when it has one, which `insideNextTo` needs: the arc between their
 * centers then crosses no other cell holding boundary samples. A cell found
 * only by a vertex has no boundary cell across any of its edges, which covers
 * every other cell around that vertex.
 */
export function boundaryNeighbors(boundary: number[], walks: NeighborWalk[]): {cells: number[]; parents: number[]} {
  const seen = new Set<number>();
  for (let c = 0; c < boundary.length; c += 5) {
    seen.add(tripleCellKey(boundary[c], boundary[c + 1], boundary[c + 2], boundary[c + 3], boundary[c + 4]));
  }
  const cells: number[] = [];
  const parents: number[] = [];
  let parent = 0;
  const visit = (originId: number, quintant: number, x: number, y: number, z: number) => {
    const key = tripleCellKey(originId, quintant, x, y, z);
    if (seen.has(key)) return;
    seen.add(key);
    cells.push(originId, quintant, x, y, z);
    parents.push(parent);
  };
  for (const walk of walks) {
    for (let c = 0; c < boundary.length; c += 5) {
      parent = c / 5;
      walk(boundary, c, visit);
    }
  }
  return {cells, parents};
}

/** Area of the polygon (outer ring minus holes) on the unit sphere, in steradians. */
export function polygonArea(ringVecsList: Cartesian[][]): number {
  let total = 0;
  for (let r = 0; r < ringVecsList.length; r++) {
    // Signed fan from the first vertex: concave rings come out right too
    const ring = ringVecsList[r];
    let area = 0;
    for (let i = 1; i + 1 < ring.length; i++) area += sphericalTriangleArea(ring[0], ring[i], ring[i + 1]);
    total += r === 0 ? Math.abs(area) : -Math.abs(area);
  }
  return total;
}

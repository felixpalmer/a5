// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type {Cartesian, Face, LonLat, Spherical} from '../core/coordinate-systems';
import type {Triple} from '../lattice';
import {tripleFlavor} from '../lattice';
import {lonLatToCell, sphericalToCell, cellIntersectsSegment, lastCellShape, lastProjection} from '../core/cell';
import {fromLonLat, toCartesian, toSpherical, toLonLat} from '../core/coordinate-transforms';
import {deserialize, serialize, FIRST_HILBERT_RESOLUTION} from '../core/serialization';
import {walkFaces} from '../core/face-adjacency';
import {origins} from '../core/origin';
import type {OriginId} from '../core/utils';
import {getPentagonVertices} from '../core/tiling';
import type {PentagonShape} from '../geometry/pentagon';
import {DodecahedronProjection} from '../projections/dodecahedron';
import {estimateCellRadius} from './cap';
import {sampleGreatCircleArc} from '../utils/great-circle';
import * as vec3 from '../math/vec3';
import {cellIdsToTriples, tripleCellToId, walkTripleCells} from './triple-cells';

const dodecahedron = new DodecahedronProjection();

// A cell's pentagon and origin, as `sphericalToCell` built them
type CellShape = NonNullable<ReturnType<typeof lastCellShape>>;
// The part of a sub-segment inside one pentagon
type SegmentClip = NonNullable<ReturnType<PentagonShape['clipSegment']>>;

/**
 * Resolution 0 version of the sub-segment BFS below: the cells are the 12
 * dodecahedron faces, adjacent across their edges.
 */
function traceFaces(cellA: bigint, cellB: bigint, a: LonLat, b: LonLat, addCell: (cell: bigint) => void): void {
  walkFaces([deserialize(cellA).origin.id, deserialize(cellB).origin.id], face => {
    const cell = serialize({origin: origins[face], segment: 0, S: 0n, resolution: 0});
    if (!cellIntersectsSegment(cell, a, b)) return false;
    addCell(cell);
    return true;
  });
}

// Tolerance on where (as a fraction of the sub-segment) the part in one cell
// ends and the part in the next begins, and how far (as a fraction of the
// edge) the crossing must be from the edge's ends for no third cell to touch it
const SHARED_EDGE_EPS = 1e-9;
const SHARED_EDGE_MARGIN = 1e-6;

// Scratch: the current sub-segment's endpoints projected onto each face, filled on demand
const faceA: (Face | null)[] = new Array(origins.length);
const faceB: (Face | null)[] = new Array(origins.length);

/**
 * Visit every cell a path of great-circle arcs touches, arc by arc and in order
 * along each arc, with the index of the arc (a cell may be visited more than
 * once). The path joins consecutive `points`, and the last back to the first
 * when `closed`. With `exact` false only the cells holding the samples are
 * visited, which can miss a cell whose corner an arc clips between samples.
 *
 * Each arc is sampled at half-cell-radius intervals. A pair of consecutive
 * samples within one cell needs nothing more: cells are convex and the
 * sub-segment between them is short enough to be straight (projected onto the
 * cell's Face). Between two cells, clipping the sub-segment to their pentagons
 * usually shows it crossing straight from one into the other, or clipping one
 * cell between them; otherwise a strict local search finds every cell whose
 * pentagon it touches.
 *
 * The search runs in triple space: a cell's neighbors come from its flavor's
 * triple deltas plus the boundary delta tables, and its pentagon straight from
 * its triple, so a candidate is never decoded and only touched cells are
 * encoded.
 */
export function tracePath(
  points: LonLat[],
  closed: boolean,
  resolution: number,
  visit: (cell: bigint, arc: number) => void,
  exact = true
): void {
  const sampleInterval = estimateCellRadius(resolution) * 0.5;
  const hilbertRes = resolution - FIRST_HILBERT_RESOLUTION + 1;
  const maxRow = (1 << hilbertRes) - 1;

  // Each point once: on the sphere, as a vector, and its cell
  const n = points.length;
  const pointSpherical: Spherical[] = new Array(n);
  const pointVecs: Cartesian[] = new Array(n);
  const pointCells: bigint[] = new Array(n);
  const pointShapes: (CellShape | null)[] = new Array(n);
  const pointFaces: (Face | null)[] = new Array(n);
  for (let i = 0; i < n; i++) {
    pointSpherical[i] = fromLonLat(points[i]);
    pointVecs[i] = toCartesian(pointSpherical[i]);
    pointCells[i] = sphericalToCell(pointSpherical[i], resolution);
    pointShapes[i] = lastCellShape(pointCells[i]);
    const shape = pointShapes[i];
    pointFaces[i] = shape === null ? null : lastProjection(pointSpherical[i], shape.originId);
  }

  // The current sub-segment, on the sphere, with each end's cell pentagon and
  // origin and its own projection there, as the lookup of its cell made them
  let a: Spherical;
  let shapeA: CellShape | null = null;
  let shapeB: CellShape | null = null;
  let b: Spherical;
  // Each sub-segment end as its cell's lookup projected it, if it did: the
  // projections below reuse them rather than projecting again
  let faceOfA: Face | null = null;
  let faceOfB: Face | null = null;
  const faceOf = (point: Spherical, shape: CellShape | null) =>
    shape === null ? null : lastProjection(point, shape.originId);
  const project = (originId: number) => {
    if (faceA[originId] === null) {
      faceA[originId] =
        faceOfA !== null && shapeA !== null && originId === shapeA.originId
          ? faceOfA
          : (dodecahedron.forward(a, originId as OriginId) as Face);
      faceB[originId] =
        faceOfB !== null && shapeB !== null && originId === shapeB.originId
          ? faceOfB
          : (dodecahedron.forward(b, originId as OriginId) as Face);
    }
  };
  const pentagonOf = (quintant: number, triple: Triple) =>
    getPentagonVertices(hilbertRes, quintant, triple, tripleFlavor(triple, maxRow));
  const touches = (originId: number, quintant: number, triple: Triple): boolean => {
    project(originId);
    return pentagonOf(quintant, triple).intersectsSegment(faceA[originId]!, faceB[originId]!);
  };
  // Whether the sub-segment, clipped to each cell it passes through in turn,
  // hands over cleanly: from a (in the first part) to b (in the last), each part
  // ends where the next begins, at a point well inside an edge, so no other
  // cell meets the sub-segment there.
  const handsOver = (parts: (SegmentClip | null)[]): boolean => {
    let prevEnd = 0;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part === null) return false;
      if (i === 0 ? part.start > SHARED_EDGE_EPS : Math.abs(part.start - prevEnd) > SHARED_EDGE_EPS) return false;
      if (i === parts.length - 1) return part.end >= 1 - SHARED_EDGE_EPS;
      if (part.exitEdgeT <= SHARED_EDGE_MARGIN || part.exitEdgeT >= 1 - SHARED_EDGE_MARGIN) return false;
      prevEnd = part.end;
    }
    return false;
  };

  // Settle the sub-segment from cell A to cell B (on one origin) without the
  // full search. It usually runs straight from A into B; failing that, it
  // usually clips one cell C between them, found at the middle of the gap and
  // then visited. False sends the sub-segment to the full search.
  const settle = (cellA: bigint, shapeA: CellShape, cellB: bigint, shapeB: CellShape, arc: number): boolean => {
    const originId = shapeA.originId;
    if (shapeB.originId !== originId) return false;
    project(originId);
    const fa = faceA[originId]!;
    const fb = faceB[originId]!;
    const inA = shapeA.pentagon.clipSegment(fa, fb);
    const inB = shapeB.pentagon.clipSegment(fa, fb);
    if (handsOver([inA, inB])) return true;
    if (inA === null || inB === null || inB.start <= inA.end) return false;
    const t = (inA.end + inB.start) / 2;
    const mid = vec3.normalize(vec3.create(), vec3.lerp(vec3.create(), toCartesian(a), toCartesian(b), t)) as Cartesian;
    const cellC = sphericalToCell(toSpherical(mid), resolution);
    const shapeC = lastCellShape(cellC);
    if (shapeC === null || shapeC.originId !== originId || cellC === cellA || cellC === cellB) return false;
    if (!handsOver([inA, shapeC.pentagon.clipSegment(fa, fb), inB])) return false;
    visit(cellC, arc);
    return true;
  };

  // Strict local search: walk out from A and B, keeping every cell whose
  // pentagon the sub-segment crosses. Terminates as soon as no new touching
  // cells are found — typically 1–2 hops, since a sub-segment ≤ cellRadius/2
  // reaches at most a couple of cells beyond its endpoint cells.
  const searchSubsegment = (cellA: bigint, cellB: bigint, arc: number) => {
    walkTripleCells(cellIdsToTriples([cellA, cellB]), maxRow, (originId, quintant, x, y, z) => {
      if (!touches(originId, quintant, {x, y, z})) return false;
      visit(tripleCellToId(originId, quintant, x, y, z, hilbertRes, resolution), arc);
      return true;
    });
  };

  const arcs = closed ? n : n - 1;
  for (let arc = 0; arc < arcs; arc++) {
    const end = (arc + 1) % n;
    // Sample the great-circle at half-cell-radius spacing, endpoints included
    const interior = sampleGreatCircleArc(pointVecs[arc], pointVecs[end], sampleInterval);
    const last = interior.length + 1;
    const sampleAt = (j: number): Spherical =>
      j === 0 ? pointSpherical[arc] : j === last ? pointSpherical[end] : toSpherical(interior[j - 1]);

    let cellA = pointCells[arc];
    shapeA = pointShapes[arc];
    faceOfA = pointFaces[arc];
    b = pointSpherical[arc];
    visit(cellA, arc);
    // Walk pairwise. Each (P_j, P_{j+1}) sub-segment is short enough that its
    // projection onto any nearby cell's Face is essentially straight, so we
    // can use exact 2D segment-vs-pentagon intersection.
    for (let j = 1; j <= last; j++) {
      a = b;
      b = sampleAt(j);
      const cellB = j === last ? pointCells[end] : sphericalToCell(b, resolution);
      shapeB = j === last ? pointShapes[end] : lastCellShape(cellB);
      faceOfB = j === last ? pointFaces[end] : faceOf(b, shapeB);
      visit(cellB, arc);
      const search = cellA !== cellB && exact;
      if (search && resolution === 0) {
        traceFaces(cellA, cellB, toLonLat(a), toLonLat(b), cell => visit(cell, arc));
      } else if (search) {
        faceA.fill(null);
        faceB.fill(null);
        if (shapeA === null || shapeB === null || !settle(cellA, shapeA, cellB, shapeB, arc)) {
          searchSubsegment(cellA, cellB, arc);
        }
      }
      cellA = cellB;
      shapeA = shapeB;
      faceOfA = faceOfB;
    }
  }
}

/**
 * Trace cells along a polyline defined by a sequence of waypoints.
 *
 * Consecutive waypoints are connected with great-circle arcs, traced by
 * `tracePath`: every cell whose pentagon an arc touches. Cells at waypoint
 * junctions are deduplicated.
 *
 * Pass `[start, end]` for a simple two-point line segment.
 *
 * @returns Array of unique cell IDs along the polyline, in order
 */
export function lineStringToCells(waypoints: LonLat[], resolution: number): bigint[] {
  if (waypoints.length === 0) return [];
  if (waypoints.length === 1) return [lonLatToCell(waypoints[0], resolution)];

  const seen = new Set<bigint>();
  const result: bigint[] = [];
  tracePath(waypoints, false, resolution, cell => {
    if (!seen.has(cell)) {
      seen.add(cell);
      result.push(cell);
    }
  });
  return result;
}

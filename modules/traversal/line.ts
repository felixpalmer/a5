// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type {LonLat, Face} from '../core/coordinate-systems';
import type {Triple} from '../lattice';
import {tripleFlavor} from '../lattice';
import {lonLatToCell, cellIntersectsSegment} from '../core/cell';
import {fromLonLat, toCartesian, toSpherical, toLonLat} from '../core/coordinate-transforms';
import {deserialize, serialize, FIRST_HILBERT_RESOLUTION} from '../core/serialization';
import {walkFaces} from '../core/face-adjacency';
import {origins} from '../core/origin';
import type {OriginId} from '../core/utils';
import {getPentagonVertices} from '../core/tiling';
import {DodecahedronProjection} from '../projections/dodecahedron';
import {estimateCellRadius} from './cap';
import {sampleGreatCircleArc} from '../utils/great-circle';
import {cellIdsToTriples, forEachTripleNeighbor, tripleCellKey, tripleCellToId} from './triple-cells';

const dodecahedron = new DodecahedronProjection();

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

/**
 * Trace cells along a polyline defined by a sequence of waypoints.
 *
 * Consecutive waypoints are connected with great-circle arcs. Each arc is
 * sampled at half-cell-radius intervals; for each consecutive pair of samples,
 * a strict local BFS finds every cell whose pentagon is touched by the
 * straight 2D segment between the two samples (projected onto each candidate
 * cell's Face). Cells at waypoint junctions are deduplicated.
 *
 * The BFS runs in triple space: a cell's neighbors come from its flavor's
 * triple deltas plus the boundary delta tables, and its pentagon straight from
 * its triple, so a candidate is never decoded and only touched cells are
 * encoded.
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
  const cellRadius = estimateCellRadius(resolution);
  const sampleInterval = cellRadius * 0.5;
  const hilbertRes = resolution - FIRST_HILBERT_RESOLUTION + 1;
  const maxRow = (1 << hilbertRes) - 1;

  const addCell = (cell: bigint) => {
    if (!seen.has(cell)) {
      seen.add(cell);
      result.push(cell);
    }
  };

  // The current sub-segment, projected onto each face it is tested against
  let a: LonLat;
  let b: LonLat;
  const faceA: (Face | null)[] = new Array(origins.length);
  const faceB: (Face | null)[] = new Array(origins.length);
  const touches = (originId: number, quintant: number, triple: Triple): boolean => {
    if (faceA[originId] === null) {
      faceA[originId] = dodecahedron.forward(fromLonLat(a), originId as OriginId) as Face;
      faceB[originId] = dodecahedron.forward(fromLonLat(b), originId as OriginId) as Face;
    }
    const pentagon = getPentagonVertices(hilbertRes, quintant, triple, tripleFlavor(triple, maxRow));
    return pentagon.intersectsSegment(faceA[originId]!, faceB[originId]!);
  };

  for (let i = 0; i < waypoints.length - 1; i++) {
    const start = waypoints[i];
    const end = waypoints[i + 1];
    const startVec = toCartesian(fromLonLat(start));
    const endVec = toCartesian(fromLonLat(end));

    // Sample the great-circle at half-cell-radius spacing. Endpoints are
    // always included; even for short hops we get the start→end pair.
    const interior = sampleGreatCircleArc(startVec, endVec, sampleInterval);
    const numSubsegments = interior.length + 1;
    const samples: LonLat[] = new Array(numSubsegments + 1);
    samples[0] = start;
    samples[numSubsegments] = end;
    for (let j = 0; j < interior.length; j++) {
      samples[j + 1] = toLonLat(toSpherical(interior[j]));
    }
    // Each sample's cell, as its ID and in triple space as flat (originId, quintant, x, y, z)
    const sampleCells: bigint[] = new Array(samples.length);
    for (let j = 0; j < samples.length; j++) sampleCells[j] = lonLatToCell(samples[j], resolution);
    const sampleTriples = resolution === 0 ? [] : cellIdsToTriples(sampleCells);

    // Walk pairwise. Each (P_j, P_{j+1}) sub-segment is short enough that its
    // projection onto any nearby cell's Face is essentially straight, so we
    // can use exact 2D segment-vs-pentagon intersection.
    for (let j = 0; j < numSubsegments; j++) {
      a = samples[j];
      b = samples[j + 1];
      const cellA = sampleCells[j];
      const cellB = sampleCells[j + 1];

      addCell(cellA);
      addCell(cellB);
      if (cellA === cellB) continue;
      if (resolution === 0) {
        traceFaces(cellA, cellB, a, b, addCell);
        continue;
      }
      faceA.fill(null);
      faceB.fill(null);

      // Strict local BFS: expand neighbors of every cell known to touch this
      // sub-segment, keeping anything whose pentagon the sub-segment crosses.
      // Terminates as soon as no new touching cells are found — typically 1–2
      // hops, since a sub-segment ≤ cellRadius/2 reaches at most a couple of
      // cells beyond its endpoint cells.
      const frontierStart = sampleTriples.slice(j * 5, j * 5 + 10);
      const visited = new Set<number>();
      for (let c = 0; c < 10; c += 5) {
        const t = frontierStart;
        visited.add(tripleCellKey(t[c], t[c + 1], t[c + 2], t[c + 3], t[c + 4]));
      }
      let frontier: number[] = frontierStart;
      while (frontier.length > 0) {
        const next: number[] = [];
        const visit = (originId: number, quintant: number, x: number, y: number, z: number) => {
          const key = tripleCellKey(originId, quintant, x, y, z);
          if (visited.has(key)) return;
          visited.add(key);
          if (touches(originId, quintant, {x, y, z})) {
            addCell(tripleCellToId(originId, quintant, x, y, z, hilbertRes, resolution));
            next.push(originId, quintant, x, y, z);
          }
        };
        for (let c = 0; c < frontier.length; c += 5) {
          const f = frontier;
          forEachTripleNeighbor(f[c], f[c + 1], f[c + 2], f[c + 3], f[c + 4], maxRow, false, visit);
        }
        frontier = next;
      }
    }
  }

  return result;
}

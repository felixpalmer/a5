// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {vec3} from 'gl-matrix';
import type {LonLat, Cartesian} from '../core/coordinate-systems';
import {lonLatToCell, cellIntersectsSegment} from '../core/cell';
import {fromLonLat, toCartesian, toSpherical, toLonLat} from '../core/coordinate-transforms';
import {AUTHALIC_RADIUS_EARTH} from '../core/constants';
import {slerp} from '../utils/vector';
import {estimateCellRadius} from './cap';
import {getLatticeNeighbors} from './lattice-neighbors';

/**
 * Trace cells along a polyline defined by a sequence of waypoints.
 *
 * Consecutive waypoints are connected with great-circle arcs. Each arc is
 * sampled at half-cell-radius intervals; for each consecutive pair of samples,
 * a strict local BFS finds every cell whose pentagon is touched by the
 * straight 2D segment between the two samples (projected onto each candidate
 * cell's Face). Cells at waypoint junctions are deduplicated.
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

  const addCell = (cell: bigint) => {
    if (!seen.has(cell)) {
      seen.add(cell);
      result.push(cell);
    }
  };

  for (let i = 0; i < waypoints.length - 1; i++) {
    const start = waypoints[i];
    const end = waypoints[i + 1];
    const startVec = toCartesian(fromLonLat(start));
    const endVec = toCartesian(fromLonLat(end));
    const dot = Math.max(-1, Math.min(1, vec3.dot(startVec, endVec)));
    const dist = Math.acos(dot) * AUTHALIC_RADIUS_EARTH;

    // Sample the great-circle at half-cell-radius spacing. The endpoints are
    // always included; numSubsegments >= 1 (so we always get the start→end pair
    // even for short waypoint-to-waypoint hops).
    const numSubsegments = Math.max(1, Math.ceil(dist / sampleInterval));
    const samples: LonLat[] = new Array(numSubsegments + 1);
    samples[0] = start;
    samples[numSubsegments] = end;
    if (numSubsegments > 1) {
      const tmp = vec3.create() as Cartesian;
      for (let j = 1; j < numSubsegments; j++) {
        slerp(tmp, startVec, endVec, j / numSubsegments);
        samples[j] = toLonLat(toSpherical(tmp));
      }
    }
    const sampleCells = samples.map(s => lonLatToCell(s, resolution));

    // Walk pairwise. Each (P_j, P_{j+1}) sub-segment is short enough that its
    // projection onto any nearby cell's Face is essentially straight, so we
    // can use exact 2D segment-vs-pentagon intersection.
    for (let j = 0; j < numSubsegments; j++) {
      const a = samples[j];
      const b = samples[j + 1];
      const cellA = sampleCells[j];
      const cellB = sampleCells[j + 1];

      addCell(cellA);
      addCell(cellB);
      if (cellA === cellB) continue;

      // Strict local BFS: expand neighbors of every cell known to touch this
      // sub-segment, keeping anything whose pentagon the sub-segment crosses.
      // Terminates as soon as no new touching cells are found — typically 1–2
      // hops, since a sub-segment ≤ cellRadius/2 reaches at most a couple of
      // cells beyond its endpoint cells.
      const visited = new Set<bigint>([cellA, cellB]);
      let frontier: bigint[] = [cellA, cellB];
      while (frontier.length > 0) {
        const next: bigint[] = [];
        for (const cell of frontier) {
          for (const neighbor of getLatticeNeighbors(cell, false)) {
            if (visited.has(neighbor)) continue;
            visited.add(neighbor);
            if (cellIntersectsSegment(neighbor, a, b)) {
              addCell(neighbor);
              next.push(neighbor);
            }
          }
        }
        frontier = next;
      }
    }
  }

  return result;
}

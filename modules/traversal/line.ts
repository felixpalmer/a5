// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {vec3} from 'gl-matrix';
import type {LonLat, Cartesian} from '../core/coordinate-systems';
import {lonLatToCell, cellToBoundary} from '../core/cell';
import {fromLonLat, toCartesian, toSpherical, toLonLat} from '../core/coordinate-transforms';
import {AUTHALIC_RADIUS_EARTH} from '../core/constants';
import {slerp} from '../utils/vector';
import {estimateCellRadius} from './cap';
import {getLatticeNeighbors} from './lattice-neighbors';

// =============================================================================
// Segment geometry — line-tracing specific
// =============================================================================

/**
 * Test whether two great-circle segments intersect on the sphere.
 * Two arcs intersect iff each segment's endpoints straddle the other's great circle.
 */
function segmentsIntersect(av: Cartesian, bv: Cartesian, cv: Cartesian, dv: Cartesian): boolean {
  // Normal to great circle through A,B
  const n1x = av[1] * bv[2] - av[2] * bv[1];
  const n1y = av[2] * bv[0] - av[0] * bv[2];
  const n1z = av[0] * bv[1] - av[1] * bv[0];

  const cDotN1 = cv[0] * n1x + cv[1] * n1y + cv[2] * n1z;
  const dDotN1 = dv[0] * n1x + dv[1] * n1y + dv[2] * n1z;
  if (cDotN1 * dDotN1 > 0) return false;

  // Normal to great circle through C,D
  const n2x = cv[1] * dv[2] - cv[2] * dv[1];
  const n2y = cv[2] * dv[0] - cv[0] * dv[2];
  const n2z = cv[0] * dv[1] - cv[1] * dv[0];

  const aDotN2 = av[0] * n2x + av[1] * n2y + av[2] * n2z;
  const bDotN2 = bv[0] * n2x + bv[1] * n2y + bv[2] * n2z;
  if (aDotN2 * bDotN2 > 0) return false;

  // Reject antipodal intersections: segment midpoints must be in same hemisphere
  const m1x = av[0] + bv[0], m1y = av[1] + bv[1], m1z = av[2] + bv[2];
  const m2x = cv[0] + dv[0], m2y = cv[1] + dv[1], m2z = cv[2] + dv[2];
  if (m1x * m2x + m1y * m2y + m1z * m2z < 0) return false;

  return true;
}

/**
 * Test whether a cell's pentagon boundary intersects a great-circle segment.
 * True if any pentagon edge crosses the segment, or if the segment endpoints
 * lie inside the cell.
 */
function cellIntersectsSegment(cellId: bigint, startVec: Cartesian, endVec: Cartesian): boolean {
  const boundary = cellToBoundary(cellId, {closedRing: true, segments: 1});
  const verts = boundary.map(ll => toCartesian(fromLonLat(ll as LonLat)));

  for (let i = 0; i < verts.length - 1; i++) {
    if (segmentsIntersect(startVec, endVec, verts[i], verts[i + 1])) return true;
  }

  // Inside test: signed cross-product against each edge — agree on sign ⇒ inside
  let positive = 0;
  let negative = 0;
  for (let i = 0; i < verts.length - 1; i++) {
    const e1x = verts[i][0] - startVec[0];
    const e1y = verts[i][1] - startVec[1];
    const e1z = verts[i][2] - startVec[2];
    const e2x = verts[i + 1][0] - startVec[0];
    const e2y = verts[i + 1][1] - startVec[1];
    const e2z = verts[i + 1][2] - startVec[2];
    const cx = e1y * e2z - e1z * e2y;
    const cy = e1z * e2x - e1x * e2z;
    const cz = e1x * e2y - e1y * e2x;
    const d = cx * startVec[0] + cy * startVec[1] + cz * startVec[2];
    if (d > 0) positive++;
    else if (d < 0) negative++;
  }
  return positive === 0 || negative === 0;
}

// =============================================================================
// Public API: line tracing
// =============================================================================

/**
 * Trace cells along a polyline defined by a sequence of waypoints.
 *
 * Connects consecutive waypoints with great-circle arcs. For each segment,
 * seeds cells at regular intervals along the arc, then BFS-expands via lattice
 * neighbors, keeping any cell whose pentagon intersects the segment. Cells at
 * waypoint junctions are deduplicated.
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
  const seedInterval = cellRadius * 0.5;

  // Pre-compute cell for each waypoint — each waypoint serves both as the end
  // of one segment and the start of the next.
  const waypointCells = waypoints.map(wp => lonLatToCell(wp, resolution));

  const addCell = (cell: bigint) => {
    if (!seen.has(cell)) {
      seen.add(cell);
      result.push(cell);
    }
  };

  for (let i = 0; i < waypoints.length - 1; i++) {
    const startCell = waypointCells[i];
    const endCell = waypointCells[i + 1];

    // Fast path: consecutive waypoints in the same cell
    if (startCell === endCell) {
      addCell(startCell);
      continue;
    }

    const start = waypoints[i];
    const end = waypoints[i + 1];
    const startVec = toCartesian(fromLonLat(start));
    const endVec = toCartesian(fromLonLat(end));
    const dot = Math.max(-1, Math.min(1, vec3.dot(startVec, endVec)));
    const dist = Math.acos(dot) * AUTHALIC_RADIUS_EARTH;

    const visited = new Set<bigint>();
    let frontier = new Set<bigint>();

    visited.add(startCell);
    frontier.add(startCell);
    addCell(startCell);
    visited.add(endCell);
    frontier.add(endCell);
    addCell(endCell);

    // For long segments (> 2 cell radii), seed intermediate points along the arc.
    // Short segments rely on BFS alone — endpoints + neighbor expansion cover them.
    if (dist > cellRadius * 2) {
      const numSeeds = Math.max(2, Math.ceil(dist / seedInterval));
      const seedVec = vec3.create() as Cartesian;
      for (let j = 1; j < numSeeds; j++) {
        const t = j / numSeeds;
        slerp(seedVec, startVec, endVec, t);
        const cell = lonLatToCell(toLonLat(toSpherical(seedVec)), resolution);
        if (!visited.has(cell)) {
          visited.add(cell);
          frontier.add(cell);
          addCell(cell);
        }
      }
    }

    while (frontier.size > 0) {
      const nextFrontier = new Set<bigint>();
      for (const cell of frontier) {
        for (const neighbor of getLatticeNeighbors(cell, false)) {
          if (visited.has(neighbor)) continue;
          visited.add(neighbor);
          if (cellIntersectsSegment(neighbor, startVec, endVec)) {
            nextFrontier.add(neighbor);
            addCell(neighbor);
          }
        }
      }
      frontier = nextFrontier;
    }
  }

  return result;
}

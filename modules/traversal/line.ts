// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type {LonLat} from '../core/coordinate-systems';
import {lonLatToCell, cellToLonLat, cellToBoundary} from '../core/cell';
import {AUTHALIC_RADIUS_EARTH} from '../core/constants';
import {cellToParent, cellToChildren, FIRST_HILBERT_RESOLUTION} from '../core/serialization';
import {compact} from '../core/compact';
import {estimateCellRadius} from './cap';
import {getLatticeNeighbors, getEdgeLatticeNeighbors, tripleSpaceFloodFill} from './lattice-neighbors';

const DEG_TO_RAD = Math.PI / 180;

type Vec3 = [number, number, number];

// =============================================================================
// Spherical geometry primitives
// =============================================================================

/** Convert lon/lat (degrees) to unit 3D vector. */
function toVec3(ll: LonLat): Vec3 {
  const lat = ll[1] * DEG_TO_RAD;
  const lon = ll[0] * DEG_TO_RAD;
  const cosLat = Math.cos(lat);
  return [cosLat * Math.cos(lon), cosLat * Math.sin(lon), Math.sin(lat)];
}

/**
 * Spherical point-in-polygon via angle summation. Works for concave polygons.
 * Operates on precomputed vec3 arrays — avoids redundant toVec3 calls on the ring.
 */
function pointInPolygonVec3(pv: Vec3, vecs: Vec3[]): boolean {
  let angleSum = 0;
  for (let i = 0; i < vecs.length; i++) {
    const av = vecs[i];
    const bv = vecs[(i + 1) % vecs.length];
    const dotPA = pv[0] * av[0] + pv[1] * av[1] + pv[2] * av[2];
    const dotPB = pv[0] * bv[0] + pv[1] * bv[1] + pv[2] * bv[2];
    const apx = av[0] - dotPA * pv[0], apy = av[1] - dotPA * pv[1], apz = av[2] - dotPA * pv[2];
    const bpx = bv[0] - dotPB * pv[0], bpy = bv[1] - dotPB * pv[1], bpz = bv[2] - dotPB * pv[2];
    const cx = apy * bpz - apz * bpy;
    const cy = apz * bpx - apx * bpz;
    const cz = apx * bpy - apy * bpx;
    angleSum += Math.atan2(cx * pv[0] + cy * pv[1] + cz * pv[2], apx * bpx + apy * bpy + apz * bpz);
  }
  return Math.abs(angleSum) > Math.PI;
}

/** Great-circle distance between two lon/lat points, in meters. */
function greatCircleDistance(a: LonLat, b: LonLat): number {
  const lat1 = a[1] * DEG_TO_RAD;
  const lat2 = b[1] * DEG_TO_RAD;
  const dLat = lat2 - lat1;
  const dLon = (b[0] - a[0]) * DEG_TO_RAD;
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * AUTHALIC_RADIUS_EARTH * Math.asin(Math.sqrt(h));
}

/** Spherical linear interpolation along a great-circle arc. */
function greatCircleSlerp(a: LonLat, b: LonLat, t: number): LonLat {
  const [ax, ay, az] = toVec3(a);
  const [bx, by, bz] = toVec3(b);

  let dot = ax * bx + ay * by + az * bz;
  dot = Math.max(-1, Math.min(1, dot));

  const omega = Math.acos(dot);
  if (omega < 1e-10) {
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])] as LonLat;
  }

  const sinOmega = Math.sin(omega);
  const fA = Math.sin((1 - t) * omega) / sinOmega;
  const fB = Math.sin(t * omega) / sinOmega;

  const rx = fA * ax + fB * bx;
  const ry = fA * ay + fB * by;
  const rz = fA * az + fB * bz;

  return [Math.atan2(ry, rx) / DEG_TO_RAD, Math.asin(Math.max(-1, Math.min(1, rz))) / DEG_TO_RAD] as LonLat;
}

/**
 * Test whether two great-circle segments intersect on the sphere.
 * Two arcs intersect iff each segment's endpoints straddle the other's great circle.
 */
function segmentsIntersect(av: Vec3, bv: Vec3, cv: Vec3, dv: Vec3): boolean {
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
function cellIntersectsSegment(cellId: bigint, startVec: Vec3, endVec: Vec3): boolean {
  const boundary = cellToBoundary(cellId, {closedRing: true, segments: 1});
  const verts = boundary.map(ll => toVec3(ll as LonLat));

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
 * Trace cells along a great-circle line segment between two points.
 *
 * Seeds cells at regular intervals along the segment, then BFS-expands via
 * lattice neighbors, keeping any cell whose pentagon intersects the segment.
 *
 * @returns Array of unique cell IDs along the segment
 */
export function lineSegmentToCells(start: LonLat, end: LonLat, resolution: number): bigint[] {
  const startCell = lonLatToCell(start, resolution);
  const endCell = lonLatToCell(end, resolution);

  // Fast path: both endpoints in the same cell (very common for dense polylines)
  if (startCell === endCell) return [startCell];

  const dist = greatCircleDistance(start, end);
  const cellRadius = estimateCellRadius(resolution);

  const startVec = toVec3(start);
  const endVec = toVec3(end);

  // 0.5 cell radii is just the BFS seed density — the actual membership test is
  // cellIntersectsSegment downstream. Polygon fill uses 0.4 because there each
  // sample IS the boundary-cell decision (a miss = flood-fill leak).
  const seedInterval = cellRadius * 0.5;
  const numSeeds = Math.max(2, Math.ceil(dist / seedInterval));

  const visited = new Set<bigint>();
  const result: bigint[] = [];
  let frontier = new Set<bigint>();

  visited.add(startCell);
  result.push(startCell);
  frontier.add(startCell);
  if (!visited.has(endCell)) {
    visited.add(endCell);
    result.push(endCell);
    frontier.add(endCell);
  }

  for (let i = 1; i < numSeeds; i++) {
    const t = i / numSeeds;
    const cell = lonLatToCell(greatCircleSlerp(start, end, t), resolution);
    if (!visited.has(cell)) {
      visited.add(cell);
      result.push(cell);
      frontier.add(cell);
    }
  }

  // BFS: expand via lattice neighbors, keep cells that intersect the segment
  while (frontier.size > 0) {
    const nextFrontier = new Set<bigint>();
    for (const cell of frontier) {
      for (const neighbor of getLatticeNeighbors(cell, false)) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        if (cellIntersectsSegment(neighbor, startVec, endVec)) {
          result.push(neighbor);
          nextFrontier.add(neighbor);
        }
      }
    }
    frontier = nextFrontier;
  }

  return result;
}

/**
 * Trace cells along a polyline defined by a sequence of waypoints.
 *
 * Connects consecutive waypoints with great-circle arcs and returns all
 * cells along the path. Cells at waypoint junctions are deduplicated.
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
    const dist = greatCircleDistance(start, end);
    const startVec = toVec3(start);
    const endVec = toVec3(end);

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
      for (let j = 1; j < numSeeds; j++) {
        const t = j / numSeeds;
        const cell = lonLatToCell(greatCircleSlerp(start, end, t), resolution);
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

// =============================================================================
// Public API: polygon fill
// =============================================================================

/**
 * Maps each boundary cell to the indices of the ring segments that produced it.
 * Used by `filterBoundaryCells` to short-circuit PIP via segment-side dot products.
 */
type SegmentMap = Map<bigint, number[]>;

/**
 * Dense-sample boundary cells along the closed polygon ring.
 *
 * Mirrors H3's strategy: interpolate at `cellRadius * 0.4` intervals along each
 * edge and call `lonLatToCell` per sample. Faster than BFS + cellIntersectsSegment
 * because each sample is a direct projection (no pentagon geometry math).
 */
function denseSampleBoundary(
  ring: LonLat[], resolution: number,
): {boundaryCells: bigint[], boundarySet: Set<bigint>, segmentMap: SegmentMap} {
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

  const vertexCells = ring.map(p => lonLatToCell(p, resolution));

  for (let i = 0; i < ring.length; i++) {
    const nextI = (i + 1) % ring.length;
    recordCell(vertexCells[i], i);

    const dist = greatCircleDistance(ring[i], ring[nextI]);
    const numSamples = Math.max(1, Math.ceil(dist / sampleInterval));
    for (let j = 1; j < numSamples; j++) {
      const t = j / numSamples;
      recordCell(lonLatToCell(greatCircleSlerp(ring[i], ring[nextI], t), resolution), i);
    }
    recordCell(vertexCells[nextI], i);
  }

  return {boundaryCells, boundarySet, segmentMap};
}

/**
 * Determine ring winding direction. Returns +1 for CCW, -1 for CW.
 *
 * For each ring segment, computes (v_i × v_{i+1}) · centroid; sums the votes.
 * Positive sum = CCW (interior is to the LEFT of boundary direction); negative = CW.
 */
function ringWindingSign(ringVecs: Vec3[]): 1 | -1 {
  let cx = 0, cy = 0, cz = 0;
  for (const v of ringVecs) { cx += v[0]; cy += v[1]; cz += v[2]; }
  const cLen = Math.sqrt(cx * cx + cy * cy + cz * cz);
  cx /= cLen; cy /= cLen; cz /= cLen;

  let sum = 0;
  for (let i = 0; i < ringVecs.length; i++) {
    const a = ringVecs[i];
    const b = ringVecs[(i + 1) % ringVecs.length];
    const crossX = a[1] * b[2] - a[2] * b[1];
    const crossY = a[2] * b[0] - a[0] * b[2];
    const crossZ = a[0] * b[1] - a[1] * b[0];
    sum += crossX * cx + crossY * cy + crossZ * cz;
  }
  return sum > 0 ? 1 : -1;
}

/** Compute great-circle plane normals for every segment of the ring. */
function ringSegmentNormals(ringVecs: Vec3[]): Vec3[] {
  const normals: Vec3[] = new Array(ringVecs.length);
  for (let i = 0; i < ringVecs.length; i++) {
    const a = ringVecs[i];
    const b = ringVecs[(i + 1) % ringVecs.length];
    normals[i] = [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  }
  return normals;
}

/**
 * Filter boundary cells to those whose center is inside the polygon.
 *
 * For each cell we know which ring segment(s) sampled it. When all of those
 * segments place the cell on the interior side (cheap signed-dot test), we
 * accept immediately. When they disagree (vertex / concave corner) or the
 * cell wasn't recorded, fall back to full PIP.
 */
function filterBoundaryCells(
  boundaryCells: bigint[], segmentMap: SegmentMap,
  segNormals: Vec3[], ringVecs: Vec3[], interiorSign: 1 | -1,
): bigint[] {
  const out: bigint[] = [];
  for (const cell of boundaryCells) {
    const cv = toVec3(cellToLonLat(cell));
    const segments = segmentMap.get(cell);
    if (!segments) {
      if (pointInPolygonVec3(cv, ringVecs)) out.push(cell);
      continue;
    }
    let allInside = true;
    let anyInside = false;
    let ambiguous = false;
    for (const segIdx of segments) {
      const n = segNormals[segIdx];
      const dot = n[0] * cv[0] + n[1] * cv[1] + n[2] * cv[2];
      if (Math.abs(dot) < 1e-14) { ambiguous = true; break; }
      if (dot * interiorSign > 0) anyInside = true;
      else allInside = false;
    }
    if (ambiguous || (anyInside && !allInside)) {
      if (pointInPolygonVec3(cv, ringVecs)) out.push(cell);
    } else if (allInside) {
      out.push(cell);
    }
  }
  return out;
}

/**
 * Buffer the boundary by one cell using 3-edge lattice neighbors. The shell
 * matches the connectivity of `tripleSpaceFloodFill` so the firewall (boundary
 * + exterior shell) is a tight topological barrier for the subsequent flood.
 */
function expandShell(boundaryCells: bigint[], boundarySet: Set<bigint>): bigint[] {
  const shellCells: bigint[] = [];
  const shellSet = new Set<bigint>();
  for (const cell of boundaryCells) {
    for (const neighbor of getEdgeLatticeNeighbors(cell)) {
      if (boundarySet.has(neighbor)) continue;
      if (!shellSet.has(neighbor)) {
        shellSet.add(neighbor);
        shellCells.push(neighbor);
      }
    }
  }
  return shellCells;
}

/**
 * Hierarchical flood fill from interior seed cells.
 *
 * 1. Run 3 fine BFS layers to push the frontier away from the boundary.
 * 2. Switch to coarser resolution (parentRes), bounded by a coarse firewall,
 *    to cheaply cover the deep interior.
 * 3. Emit coarse interior cells directly (no per-child expansion); fine cells
 *    that fall inside an emitted coarse parent are dropped to avoid overlap.
 *    The coarse cells' children are still pushed into `visited` so phase 3's
 *    fine BFS treats them as a firewall.
 * 4. Resume fine BFS from phase 1's frontier to fill gaps near the boundary.
 *
 * Skips the coarse phase when the polygon is small enough that single-pass
 * BFS is cheaper than the coarse-firewall setup overhead.
 */
function floodInterior(
  interiorSeeds: bigint[], visited: Set<bigint>, boundarySize: number, resolution: number,
): bigint[] {
  // Add interiorSeeds to visited so phase 1's BFS doesn't revisit them
  for (const cell of interiorSeeds) visited.add(cell);

  // Coarse pre-fill is only worthwhile when the interior is large relative to
  // the overhead. The isoperimetric inequality bounds max interior at B²/(4π)
  // for B boundary cells.
  const maxInterior = boundarySize * boundarySize / (4 * Math.PI);
  // Restricted to Hilbert range below MAX_RESOLUTION because the parent-emit
  // optimization uses a bit-level parent computation that assumes the standard
  // (non-res-30) encoding.
  const useCoarsePhase = resolution > FIRST_HILBERT_RESOLUTION
    && resolution < 30
    && maxInterior > 1000;

  if (!useCoarsePhase) {
    const result = tripleSpaceFloodFill(visited, interiorSeeds, resolution);
    return [...interiorSeeds, ...result.interiorCells];
  }

  const parentRes = resolution - 1;
  const coarseFirewall = new Set<bigint>();
  for (const cell of visited) coarseFirewall.add(cellToParent(cell, parentRes));

  // Phase 1: 3 fine BFS layers to move the frontier off the boundary
  const phase1 = tripleSpaceFloodFill(visited, interiorSeeds, resolution, 3);

  // Phase 2: coarse BFS through the bulk interior
  let coarseInteriorSet: Set<bigint> | null = null;
  const phase3Delta: bigint[] = [];
  const coarseInteriorCells: bigint[] = [];
  if (phase1.frontierCellIds.length > 0) {
    const coarseSeeds = new Set<bigint>();
    for (const cell of phase1.frontierCellIds) {
      const parent = cellToParent(cell, parentRes);
      if (!coarseFirewall.has(parent)) coarseSeeds.add(parent);
    }

    if (coarseSeeds.size > 0) {
      const coarseVisited = new Set(coarseFirewall);
      for (const seed of coarseSeeds) coarseVisited.add(seed);
      const coarseResult = tripleSpaceFloodFill(coarseVisited, [...coarseSeeds], parentRes);
      const coarseInterior = [...coarseSeeds, ...coarseResult.interiorCells];
      coarseInteriorSet = new Set(coarseInterior);
      coarseInteriorCells.push(...coarseInterior);

      // Push children into visited (firewall for phase 3) without emitting
      // them — the parent will represent them in the output.
      for (const coarseCell of coarseInterior) {
        for (const child of cellToChildren(coarseCell, resolution)) {
          if (!visited.has(child)) {
            visited.add(child);
            phase3Delta.push(child);
          }
        }
      }
    }
  }

  // Emit fine cells (interior seeds + phase 1 interior) only when they aren't
  // already covered by an emitted coarse parent.
  const interiorCells: bigint[] = [];
  if (coarseInteriorSet === null) {
    interiorCells.push(...interiorSeeds, ...phase1.interiorCells);
  } else {
    for (const cell of interiorSeeds) {
      if (!coarseInteriorSet.has(cellToParent(cell, resolution - 1))) {
        interiorCells.push(cell);
      }
    }
    for (const cell of phase1.interiorCells) {
      if (!coarseInteriorSet.has(cellToParent(cell, resolution - 1))) {
        interiorCells.push(cell);
      }
    }
    interiorCells.push(...coarseInteriorCells);
  }

  // Phase 3: resume fine BFS to fill gaps near the boundary, reusing phase 1's
  // packed state (avoids re-converting the full fine firewall).
  const phase3 = tripleSpaceFloodFill(
    {state: phase1.state, delta: phase3Delta},
    phase1.frontierCellIds,
    resolution,
  );
  interiorCells.push(...phase3.interiorCells);

  return interiorCells;
}

/**
 * Find all cells within a polygon using center-point containment.
 *
 * A cell belongs to the polygon iff its center point lies inside, ensuring
 * non-overlapping coverage of adjacent polygons sharing an edge.
 *
 * Pipeline:
 *   1. Dense-sample boundary cells along the closed polygon ring
 *   2. Determine winding direction
 *   3. Filter boundary cells via segment-side test (PIP fallback for ambiguous)
 *   4. Buffer boundary into a shell, classify each shell cell as interior/exterior
 *   5. Hierarchical flood fill from interior seeds (bounded by boundary + exterior shell)
 *
 * The result is compacted — use [`uncompact`](../core/compact) to expand to
 * the input resolution.
 *
 * @param ring - Polygon vertices [longitude, latitude] (unclosed — closed automatically)
 * @returns Sorted, compacted BigUint64Array of cell IDs whose centers lie inside the polygon
 */
export function polygonToCells(ring: LonLat[], resolution: number): BigUint64Array {
  if (ring.length < 3) return new BigUint64Array(0);

  // 1. Dense-sample boundary
  const {boundaryCells, boundarySet, segmentMap} = denseSampleBoundary(ring, resolution);

  // 2. Winding sign + segment normals
  const ringVecs = ring.map(toVec3);
  const interiorSign = ringWindingSign(ringVecs);
  const segNormals = ringSegmentNormals(ringVecs);

  // 3. Filter boundary cells (per-cell PIP, accelerated by segment-side test)
  const filteredBoundary = filterBoundaryCells(boundaryCells, segmentMap, segNormals, ringVecs, interiorSign);

  // 4. Shell buffering + per-cell classification
  //
  // Dense sampling can leave small gaps where the polygon edge passes through
  // unsampled cells, so a shell component may straddle interior and exterior.
  // Per-cell PIP is robust to that.
  const shellCells = expandShell(boundaryCells, boundarySet);
  if (shellCells.length === 0) return compact(filteredBoundary);

  const interiorSeeds: bigint[] = [];
  const visited = new Set(boundarySet);
  for (const cell of shellCells) {
    if (pointInPolygonVec3(toVec3(cellToLonLat(cell)), ringVecs)) {
      interiorSeeds.push(cell);
    } else {
      visited.add(cell); // exterior shell joins the firewall
    }
  }
  if (interiorSeeds.length === 0) return compact(filteredBoundary);

  // 5. Hierarchical flood fill
  const interiorCells = floodInterior(interiorSeeds, visited, boundarySet.size, resolution);

  return compact([...filteredBoundary, ...interiorCells]);
}

// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type {LonLat, Cartesian} from '../core/coordinate-systems';
import {lonLatToCell, sphericalToCell, cellToSpherical} from '../core/cell';
import {fromLonLat, toCartesian, toSpherical} from '../core/coordinate-transforms';
import {cellToParent, cellToChildren, FIRST_HILBERT_RESOLUTION, MAX_RESOLUTION} from '../core/serialization';
import {compact} from '../core/compact';
import {pointInSphericalPolygon, ringWindingSign, ringSegmentNormals} from '../geometry/spherical-polygon';
import {estimateCellRadius} from '../traversal/cap';
import {sampleGreatCircleArc} from '../utils/great-circle';
import {getLatticeNeighbors} from '../traversal/lattice-neighbors';
import {tripleSpaceFloodFill} from '../traversal/lattice-flood-fill';

/**
 * Maps each boundary cell to the indices of the ring segments that produced it.
 * Used by `filterBoundaryCells` to short-circuit PIP via segment-side dot products.
 */
type SegmentMap = Map<bigint, number[]>;

/**
 * Dense-sample boundary cells along the closed polygon ring at
 * `cellRadius * 0.4` spacing, calling `sphericalToCell` per sample.
 */
function denseSampleBoundary(
  ring: LonLat[], ringVecs: Cartesian[], resolution: number,
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

    // Skip the lonLat round-trip: samples are authalic-Cartesian already.
    const samples = sampleGreatCircleArc(ringVecs[i], ringVecs[nextI], sampleInterval);
    for (const s of samples) {
      recordCell(sphericalToCell(toSpherical(s), resolution), i);
    }
    recordCell(vertexCells[nextI], i);
  }

  return {boundaryCells, boundarySet, segmentMap};
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
  segNormals: Cartesian[], ringVecs: Cartesian[], interiorSign: 1 | -1,
): bigint[] {
  const out: bigint[] = [];
  for (const cell of boundaryCells) {
    const cv = toCartesian(cellToSpherical(cell));
    const segments = segmentMap.get(cell);
    if (!segments) {
      if (pointInSphericalPolygon(cv, ringVecs)) out.push(cell);
      continue;
    }
    let allInside = true;
    let anyInside = false;
    let ambiguous = false;
    for (const segIdx of segments) {
      const n = segNormals[segIdx];
      const dot = n[0] * cv[0] + n[1] * cv[1] + n[2] * cv[2];
      if (Math.abs(dot) < 1e-14) { ambiguous = true; break; } // on segment within float epsilon
      if (dot * interiorSign > 0) anyInside = true;
      else allInside = false;
    }
    if (ambiguous || (anyInside && !allInside)) {
      if (pointInSphericalPolygon(cv, ringVecs)) out.push(cell);
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
    for (const neighbor of getLatticeNeighbors(cell, true)) {
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
 * Hierarchical flood fill from interior seed cells. Runs a few fine BFS layers
 * to clear the boundary, then a coarse-resolution BFS through the bulk, then
 * resumes fine BFS to fill gaps near the boundary. The coarse phase is skipped
 * when the polygon is too small to amortize its setup overhead.
 */
function floodInterior(
  interiorSeeds: bigint[], visited: Set<bigint>, boundarySize: number, resolution: number,
): bigint[] {
  for (const cell of interiorSeeds) visited.add(cell);

  // Isoperimetric bound: B² / (4π) is the max interior for B boundary cells.
  const maxInterior = boundarySize * boundarySize / (4 * Math.PI);
  // res 30 has a different encoding the parent-emit optimization can't use.
  const useCoarsePhase = resolution > FIRST_HILBERT_RESOLUTION
    && resolution < MAX_RESOLUTION
    && maxInterior > 1000;

  if (!useCoarsePhase) {
    const result = tripleSpaceFloodFill(visited, interiorSeeds, resolution);
    return [...interiorSeeds, ...result.interiorCells];
  }

  const parentRes = resolution - 1;
  const coarseFirewall = new Set<bigint>();
  for (const cell of visited) coarseFirewall.add(cellToParent(cell, parentRes));

  // Phase 1: short fine BFS to move the frontier off the boundary.
  const phase1 = tripleSpaceFloodFill(visited, interiorSeeds, resolution, 3);

  // Phase 2: coarse BFS through the bulk interior.
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

      // Children become firewall for phase 3; the coarse parent represents
      // them in the output, so we don't emit them individually.
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

  // Emit fine cells only when not already covered by a coarse parent.
  const interiorCells: bigint[] = [];
  if (coarseInteriorSet === null) {
    interiorCells.push(...interiorSeeds, ...phase1.interiorCells);
  } else {
    for (const cell of interiorSeeds) {
      if (!coarseInteriorSet.has(cellToParent(cell, parentRes))) interiorCells.push(cell);
    }
    for (const cell of phase1.interiorCells) {
      if (!coarseInteriorSet.has(cellToParent(cell, parentRes))) interiorCells.push(cell);
    }
    interiorCells.push(...coarseInteriorCells);
  }

  // Phase 3: resume fine BFS, reusing phase 1's packed state.
  const phase3 = tripleSpaceFloodFill(
    {state: phase1.state, delta: phase3Delta},
    phase1.frontierCellIds,
    resolution,
  );
  interiorCells.push(...phase3.interiorCells);

  return interiorCells;
}

/**
 * Find all cells within a polygon using center-point containment: a cell is
 * included iff its center lies inside the ring. The result is compacted — use
 * `uncompact` to expand to the input resolution.
 *
 * @param ring - Polygon vertices [longitude, latitude] (unclosed — closed automatically)
 * @returns Sorted, compacted BigUint64Array of cell IDs whose centers lie inside the polygon
 */
export function polygonToCells(ring: LonLat[], resolution: number): BigUint64Array {
  if (ring.length < 3) return new BigUint64Array(0);

  // Authalic-sphere ring vectors — A5's internal sphere, so cell centers
  // compare directly with no geodetic↔authalic round-trip.
  const ringVecs = ring.map(ll => toCartesian(fromLonLat(ll)));

  const {boundaryCells, boundarySet, segmentMap} = denseSampleBoundary(ring, ringVecs, resolution);

  const interiorSign = ringWindingSign(ringVecs);
  const segNormals = ringSegmentNormals(ringVecs);

  const filteredBoundary = filterBoundaryCells(boundaryCells, segmentMap, segNormals, ringVecs, interiorSign);

  // Dense sampling can leave gaps; the shell catches them, classifying each cell.
  const shellCells = expandShell(boundaryCells, boundarySet);
  if (shellCells.length === 0) return compact(filteredBoundary);

  const interiorSeeds: bigint[] = [];
  const visited = new Set(boundarySet);
  for (const cell of shellCells) {
    if (pointInSphericalPolygon(toCartesian(cellToSpherical(cell)), ringVecs)) {
      interiorSeeds.push(cell);
    } else {
      visited.add(cell); // exterior shell joins the firewall
    }
  }
  if (interiorSeeds.length === 0) return compact(filteredBoundary);

  const interiorCells = floodInterior(interiorSeeds, visited, boundarySet.size, resolution);

  return compact([...filteredBoundary, ...interiorCells]);
}

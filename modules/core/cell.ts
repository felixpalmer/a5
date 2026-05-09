// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { mat2, vec2, vec3, glMatrix } from "gl-matrix";
glMatrix.setMatrixArrayType(Float64Array as any);

import type { Cartesian, Face, LonLat, Spherical } from "./coordinate-systems";
import { FaceToIJ, fromLonLat, toCartesian, toLonLat, toPolar, toSpherical, normalizeLongitudes } from "./coordinate-transforms";
import { findNearestOrigin, quintantToSegment, segmentToQuintant } from "./origin";
import { DodecahedronProjection } from "../projections/dodecahedron";
import { A5Cell, OriginId } from "./utils";
import { PentagonShape } from "../geometry/pentagon";
import { getFaceVertices, getPentagonVertices, getQuintantPolar, getQuintantVertices } from "./tiling";
import { PI_OVER_5 } from "./constants";
import { IJToS, sToAnchor } from "../lattice";
import { deserialize, serialize, FIRST_HILBERT_RESOLUTION, WORLD_CELL } from "./serialization";
import { getGlobalCellNeighbors } from "../traversal/global-neighbors";

// Reuse these objects to avoid allocation
const rotation = mat2.create();
const dodecahedron = new DodecahedronProjection();

// Single-entry cache of the most recent successful lookup. Speeds up
// dense-sample workloads (polygon boundary tracing, line tracing) where
// consecutive calls often land in the same cell. The cache stores the
// pre-computed pentagon + origin so the hit-test is just one projection
// + one pentagon containment check.
let _lastResult: {
  cellId: bigint,
  pentagon: PentagonShape,
  originId: OriginId,
  resolution: number,
} | null = null;

/** Update the single-entry cache with a successful (cell, cellId) pair. */
function cacheResult(cell: A5Cell, cellId: bigint, resolution: number): bigint {
  _lastResult = {cellId, pentagon: _getPentagon(cell), originId: cell.origin.id, resolution};
  return cellId;
}

export function lonLatToCell(lonLat: LonLat, resolution: number): bigint {
  return sphericalToCell(fromLonLat(lonLat), resolution);
}

/**
 * Like `lonLatToCell`, but accepts a point already in A5's internal spherical
 * representation (rotated authalic frame, as produced by `fromLonLat` or
 * `toSpherical(authalicCartesian)`). Skips the redundant authalic
 * inverse/forward round-trip in dense-sample loops where the input already
 * comes from the authalic Cartesian space (e.g. polygon-fill boundary slerp).
 */
export function sphericalToCell(spherical: Spherical, resolution: number): bigint {
  // Resolution -1 represents WORLD_CELL, which covers the entire world
  if (resolution === -1) {
    return WORLD_CELL;
  }

  if (resolution < FIRST_HILBERT_RESOLUTION) {
    // For low resolutions there is no Hilbert curve, so we can just return as the result is exact
    return serialize(_sphericalToEstimate(spherical, resolution));
  }

  // Try the cached pentagon first — skips the full estimate pipeline when
  // consecutive calls land in the same cell (common in dense-sample loops).
  if (_lastResult && _lastResult.resolution === resolution) {
    const projected = dodecahedron.forward(spherical, _lastResult.originId);
    if (_lastResult.pentagon.containsPoint(projected as Face) > 0) return _lastResult.cellId;
  }

  // Try the original point's projection-based estimate. Common case for
  // non-boundary points.
  const firstEstimate = _sphericalToEstimate(spherical, resolution);
  const firstKey = serialize(firstEstimate);
  const firstDistance = a5cellContainsPoint(firstEstimate, spherical);
  if (firstDistance > 0) return cacheResult(firstEstimate, firstKey, resolution);

  // Spiral search: perturb the point to find nearby estimate cells (the
  // projection approximation can land in a neighbor at pentagon boundaries).
  // The perturbation is a tangent-plane spiral on the unit sphere — uniform
  // around the input point regardless of latitude, so it covers face-space
  // evenly even at the poles where (theta, phi) perturbation degenerates.
  const hilbertResolution = 1 + resolution - FIRST_HILBERT_RESOLUTION;
  const N = 25;
  const scale = (50 * Math.PI / 180) / Math.pow(2, hilbertResolution);
  const estimateSet = new Set<bigint>([firstKey]);
  const cells: {cellId: bigint, distance: number}[] = [{cellId: firstKey, distance: firstDistance}];

  // Build an orthonormal tangent basis (t1, t2) at the input point on the
  // unit sphere. The helper is chosen to avoid degeneracy near the poles.
  const c0 = toCartesian(spherical);
  const helper = Math.abs(c0[2]) < 0.9 ? VEC3_Z : VEC3_X;
  vec3.cross(_t1, c0 as unknown as vec3, helper);
  vec3.normalize(_t1, _t1);
  vec3.cross(_t2, c0 as unknown as vec3, _t1);

  // i=0 yields R=0 → same as the original sample, so start at i=1.
  for (let i = 1; i < N; i++) {
    const R = (i / N) * scale;
    const cosI = Math.cos(i), sinI = Math.sin(i);
    const cosR = Math.cos(R), sinR = Math.sin(R);
    const tx = cosI * _t1[0] + sinI * _t2[0];
    const ty = cosI * _t1[1] + sinI * _t2[1];
    const tz = cosI * _t1[2] + sinI * _t2[2];
    const perturbed: Cartesian = [
      cosR * c0[0] + sinR * tx,
      cosR * c0[1] + sinR * ty,
      cosR * c0[2] + sinR * tz,
    ] as Cartesian;
    const sample = toSpherical(perturbed);
    const estimate = _sphericalToEstimate(sample, resolution);
    const estimateKey = serialize(estimate);
    if (estimateSet.has(estimateKey)) continue;
    estimateSet.add(estimateKey);
    const distance = a5cellContainsPoint(estimate, spherical);
    if (distance > 0) return cacheResult(estimate, estimateKey, resolution);
    cells.push({cellId: estimateKey, distance});
  }

  // Neighbor expansion: cells right at the boundary can land just outside
  // due to floating-point imprecision in the cross-product test (especially
  // near the poles at very high resolutions, where pentagon edges meet
  // FP precision). Expand the search to direct neighbors of the closest
  // candidates — one of them will strictly contain the point.
  cells.sort((a, b) => b.distance - a.distance);
  const K = Math.min(3, cells.length);
  for (let k = 0; k < K; k++) {
    const neighbors = getGlobalCellNeighbors(cells[k].cellId);
    for (let n = 0; n < neighbors.length; n++) {
      const neighborKey = neighbors[n];
      if (estimateSet.has(neighborKey)) continue;
      estimateSet.add(neighborKey);
      const neighborCell = deserialize(neighborKey);
      const distance = a5cellContainsPoint(neighborCell, spherical);
      if (distance > 0) return cacheResult(neighborCell, neighborKey, resolution);
      cells.push({cellId: neighborKey, distance});
    }
  }

  // Fallback: pick the closest estimate. Cache it so subsequent dense-sample
  // calls still benefit even though this lookup was approximate.
  cells.sort((a, b) => b.distance - a.distance);
  const fallbackKey = cells[0].cellId;
  return cacheResult(deserialize(fallbackKey), fallbackKey, resolution);
}

const VEC3_X = vec3.fromValues(1, 0, 0);
const VEC3_Z = vec3.fromValues(0, 0, 1);
const _t1 = vec3.create();
const _t2 = vec3.create();

// The IJToS function uses the triangular lattice which only approximates the pentagon lattice
// Thus this function only returns an cell nearby, and we need to search the neighborhood to find the correct cell
// TODO: Implement a more accurate function
function _sphericalToEstimate(spherical: Spherical, resolution: number): A5Cell {
  const origin = {...findNearestOrigin(spherical)};

  const dodecPoint = dodecahedron.forward(spherical, origin.id);
  const polar = toPolar(dodecPoint);
  const quintant = getQuintantPolar(polar);
  const {segment, orientation} = quintantToSegment(quintant, origin);
  if (resolution < FIRST_HILBERT_RESOLUTION) {
    // For low resolutions there is no Hilbert curve
    return {S: 0n, segment, origin, resolution};
  }

  // Rotate into right fifth
  if (quintant !== 0) {
    const extraAngle = 2 * PI_OVER_5 * quintant;
    mat2.fromRotation(rotation, -extraAngle);
    vec2.transformMat2(dodecPoint, dodecPoint, rotation);
  }

  const hilbertResolution = 1 + resolution - FIRST_HILBERT_RESOLUTION;
  vec2.scale(dodecPoint, dodecPoint, 2 ** hilbertResolution);

  const ij = FaceToIJ(dodecPoint);
  let S = IJToS(ij, hilbertResolution, orientation);
  const estimate: A5Cell = {S, segment, origin, resolution};
  return estimate;
}

// TODO move into tiling.ts
export function _getPentagon({S, segment, origin, resolution}: A5Cell): PentagonShape {
  const {quintant, orientation} = segmentToQuintant(segment, origin);
  if (resolution === (FIRST_HILBERT_RESOLUTION - 1)) {
    const out = getQuintantVertices(quintant);
    return out;
  } else if (resolution === (FIRST_HILBERT_RESOLUTION - 2)) {
    return getFaceVertices();
  }

  const hilbertResolution = resolution - FIRST_HILBERT_RESOLUTION + 1;
  const anchor = sToAnchor(S, hilbertResolution, orientation);
  return getPentagonVertices(hilbertResolution, quintant, anchor);
}

export function cellToSpherical(cell: bigint): Spherical {
  const {S, segment, origin, resolution} = deserialize(cell);
  const pentagon = _getPentagon({S, segment, origin, resolution});
  return dodecahedron.inverse(pentagon.getCenter() as Face, origin.id);
}

export function cellToLonLat(cell: bigint): LonLat {
  // WORLD_CELL represents the entire world, return [0, 0] as a reasonable default
  if (cell === WORLD_CELL) {
    return [0, 0] as LonLat;
  }

  return toLonLat(cellToSpherical(cell));
}

type CellToBoundaryOptions = {
  /**
   * Pass true to close the ring with the first point
   * @default true
   */
  closedRing?: boolean;
  /**
   * Number of segments to use for each edge. Pass 'auto' to use the resolution of the cell.
   * @default 'auto'
   */
  segments?: number | 'auto';
}

export function cellToBoundary(cellId: bigint, {closedRing = true, segments = 'auto'}: CellToBoundaryOptions = {closedRing: true, segments: 'auto'}): LonLat[] {
  if (cellId === WORLD_CELL) {
    // WORLD_CELL represents the entire world and is unbounded
    return [];
  }

  const {S, segment, origin, resolution} = deserialize(cellId);
  if (segments === 'auto') {
    segments = Math.max(1,  Math.pow(2, 6 - resolution));
  }

  const pentagon = _getPentagon({S, segment, origin, resolution});

  // Split each edge into segments before projection
  // Important to do before projection to obtain equal area cells
  const splitPentagon = pentagon.splitEdges(segments);
  const vertices = splitPentagon.getVertices();

  // Unproject to obtain lon/lat coordinates. Fused loop avoids the
  // intermediate `unprojectedVertices` allocation.
  const boundary: LonLat[] = new Array(vertices.length);
  for (let i = 0; i < vertices.length; i++) {
    boundary[i] = toLonLat(dodecahedron.inverse(vertices[i], origin.id));
  }

  // Normalize longitudes to handle antimeridian crossing
  const normalizedBoundary = normalizeLongitudes(boundary);

  if (closedRing) {
    normalizedBoundary.push(normalizedBoundary[0]);
  }
  // TODO: This is a patch to make the boundary CCW, but we should fix the winding order of the pentagon
  // throughout the whole codebase
  normalizedBoundary.reverse();
  return normalizedBoundary;
}

export function a5cellContainsPoint(cell: A5Cell, spherical: Spherical): number {
  const pentagon = _getPentagon(cell);
  const projectedPoint = dodecahedron.forward(spherical, cell.origin.id);
  return pentagon.containsPoint(projectedPoint);
}

/**
 * Tests whether the segment between two LonLat points intersects a cell.
 *
 * The test runs entirely in the cell's Face coordinate system: both endpoints
 * are projected via the dodecahedron projection (with face-plane extension for
 * points beyond the face's edge), then checked against the pentagon's straight
 * 2D edges. The segment is treated as a 2D straight line in Face coords —
 * accurate when the segment is short relative to the face (DSEA distortion is
 * negligible at sub-cell scales).
 */
export function cellIntersectsSegment(cellId: bigint, a: LonLat, b: LonLat): boolean {
  if (cellId === WORLD_CELL) return true;
  const cell = deserialize(cellId);
  const pentagon = _getPentagon(cell);
  const aFace = dodecahedron.forward(fromLonLat(a), cell.origin.id);
  const bFace = dodecahedron.forward(fromLonLat(b), cell.origin.id);
  return pentagon.intersectsSegment(aFace, bFace);
}
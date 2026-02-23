// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { mat2, vec2, glMatrix } from "gl-matrix";
glMatrix.setMatrixArrayType(Float64Array as any);

import type { Face, LonLat, Spherical } from "./coordinate-systems";
import { FaceToIJ, fromLonLat, toLonLat, toPolar, normalizeLongitudes } from "./coordinate-transforms";
import { findNearestOrigin, quintantToSegment, segmentToQuintant } from "./origin";
import { DodecahedronProjection } from "../projections/dodecahedron";
import { A5Cell } from "./utils";
import { PentagonShape } from "../geometry/pentagon";
import { getFaceVertices, getPentagonVertices, getQuintantPolar, getQuintantVertices } from "./tiling";
import { PI_OVER_5 } from "./constants";
import { IJToS, sToAnchor } from "../lattice";
import { deserialize, serialize, FIRST_HILBERT_RESOLUTION, WORLD_CELL } from "./serialization";

// Reuse these objects to avoid allocation
const rotation = mat2.create();
const dodecahedron = new DodecahedronProjection();

export function lonLatToCell(lonLat: LonLat, resolution: number): bigint {
  // Resolution -1 represents WORLD_CELL, which covers the entire world
  if (resolution === -1) {
    return WORLD_CELL;
  }

  if (resolution < FIRST_HILBERT_RESOLUTION) {
    // For low resolutions there is no Hilbert curve, so we can just return as the result is exact
    return serialize(_lonLatToEstimate(lonLat, resolution));
  }

  const hilbertResolution = 1 + resolution - FIRST_HILBERT_RESOLUTION;
  const samples: LonLat[] = [lonLat];
  const N = 25;
  const scale = 50 / Math.pow(2, hilbertResolution);
  for (let i = 0; i < N; i++) {
    const R = (i / N) * scale;
    const coordinate = vec2.fromValues(Math.cos(i) * R, Math.sin(i) * R);
    vec2.add(coordinate, coordinate, lonLat);
    samples.push(coordinate as LonLat);
  }

  // Deduplicate estimates
  const estimateSet = new Set<bigint>();
  const uniqueEstimates: A5Cell[] = [];

  const cells: {cell: A5Cell, distance: number}[] = [];
  for (const sample of samples) {
    const estimate = _lonLatToEstimate(sample, resolution);
    const estimateKey = serialize(estimate);
    if (!estimateSet.has(estimateKey)) {
      // Have new estimate, add to set and list
      estimateSet.add(estimateKey);
      uniqueEstimates.push(estimate);

      // Check if we have a hit, storing distance if not
      const distance = a5cellContainsPoint(estimate, lonLat);
      if (distance > 0) {
        return serialize(estimate);
      } else {
        cells.push({cell: estimate, distance});
      }
    }
  }

  // As fallback, sort cells by distance and use the closest one
  cells.sort((a, b) => b.distance - a.distance);
  return serialize(cells[0].cell);
}

// The IJToS function uses the triangular lattice which only approximates the pentagon lattice
// Thus this function only returns an cell nearby, and we need to search the neighborhood to find the correct cell
// TODO: Implement a more accurate function
function _lonLatToEstimate(lonLat: LonLat, resolution: number): A5Cell {
  const spherical = fromLonLat(lonLat);
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

  // Unproject to obtain lon/lat coordinates
  const unprojectedVertices = vertices.map(vertex => dodecahedron.inverse(vertex, origin.id));
  const boundary = unprojectedVertices.map(vertex => toLonLat(vertex));

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

export function a5cellContainsPoint(cell: A5Cell, point: LonLat): number {
  const pentagon = _getPentagon(cell);
  const spherical = fromLonLat(point);
  const projectedPoint = dodecahedron.forward(spherical, cell.origin.id);
  return pentagon.containsPoint(projectedPoint);
}
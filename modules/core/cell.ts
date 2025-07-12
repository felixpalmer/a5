// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { mat2, vec2, glMatrix } from "gl-matrix";
glMatrix.setMatrixArrayType(Float64Array as any);

import type { Face, LonLat } from "./coordinate-systems";
import { FaceToIJ, fromLonLat, toCartesian, toFace, toLonLat, toSpherical, toPolar, normalizeLongitudes } from "./coordinate-transforms";
import { findNearestOrigin, quintantToSegment, segmentToQuintant } from "./origin";
import { DodecahedronProjection } from "../projections/dodecahedron";
import { A5Cell, PentagonShape } from "./utils";
import { getFaceVertices, getPentagonVertices, getQuintantPolar, getQuintantVertices } from "./tiling";
import { PI_OVER_5 } from "./constants";
import { IJToS, sToAnchor } from "./hilbert";
import { projectPentagon, projectPoint } from "./project";
import { deserialize, serialize, FIRST_HILBERT_RESOLUTION } from "./serialization";
import { SphericalPolygonShape, SphericalPolygon } from "./spherical-polygon";

// Reuse these objects to avoid allocation
const rotation = mat2.create();
const dodecahedron = new DodecahedronProjection();

export function lonLatToCell(lonLat: LonLat, resolution: number): bigint {
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
// Thus this function only returns an cell nearby, and we need to search the neighbourhood to find the correct cell
// TODO: Implement a more accurate function
function _lonLatToEstimate(lonLat: LonLat, resolution: number): A5Cell {
  const spherical = fromLonLat(lonLat);
  const origin = {...findNearestOrigin(spherical)};

  const dodecPoint = dodecahedron.forward(spherical, origin.id, resolution);
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

export function cellToLonLat(cell: bigint): LonLat {
  const {S, segment, origin, resolution} = deserialize(cell);
  const pentagon = _getPentagon({S, segment, origin, resolution});
  const lonLat = projectPoint(pentagon.getCenter() as Face, origin, resolution);
  return normalizeLongitudes([lonLat])[0];
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
  const {S, segment, origin, resolution} = deserialize(cellId);
  if (segments === 'auto') {
    segments = Math.max(1,  Math.pow(2, 7 - resolution));
  }

  const pentagon = _getPentagon({S, segment, origin, resolution});

  // Split each edge into segments before projection
  // Important to do before projection to obtain equal area cells
  const splitPentagon = pentagon.splitEdges(segments);
  const projectedPentagon = projectPentagon(splitPentagon, origin, resolution);

  if (closedRing) {
    projectedPentagon.push(projectedPentagon[0]);
  }
  // TODO: This is a patch to make the boundary CCW, but we should fix the winding order of the pentagon
  // throughout the whole codebase
  projectedPentagon.reverse();
  return projectedPentagon;
}

export function a5cellContainsPoint(cell: A5Cell, point: LonLat): number {
  const boundary = cellToBoundary(serialize(cell), {closedRing: false, segments: 1});

  const cartesian = toCartesian(fromLonLat(point));
  const sphericalBoundary = boundary.map(vertex => toCartesian(fromLonLat(vertex)));

  // TODO should project to dodecahedron and then check if point is inside
  const sphericalPentagon = new SphericalPolygonShape(sphericalBoundary);
  return sphericalPentagon.containsPoint(cartesian);
}
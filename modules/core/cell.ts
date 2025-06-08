// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { mat2, vec2, glMatrix } from "gl-matrix";
glMatrix.setMatrixArrayType(Float64Array as any);

import type { Cartesian, Degrees, Face, LonLat, Spherical } from "./coordinate-systems";
import { degToRad, FaceToIJ, fromLonLat, toCartesian, toFace } from "./coordinate-transforms";
import { findNearestOrigin, quintantToSegment, segmentToQuintant } from "./origin";
import { unprojectDodecahedron } from "./dodecahedron";
import { A5Cell, Pentagon, PentagonShape } from "./utils";
import { getFaceVertices, getPentagonVertices, getQuintant, getQuintantPolar, getQuintantVertices } from "./tiling";
import { PI_OVER_5 } from "./constants";
import { IJToS, sToAnchor } from "./hilbert";
import { projectPentagon, projectPoint, reprojectPentagon } from "./project";
import { deserialize, serialize, FIRST_HILBERT_RESOLUTION } from "./serialization";
import { SphericalPentagonShape } from "./spherical-pentagon";

// Reuse these objects to avoid allocation
const rotation = mat2.create();

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

  const cells: {cell: A5Cell, distance: number}[] = [];
  const estimates: {estimate: A5Cell, sample: LonLat}[] = [];
  for (const sample of samples) {
    const estimate = _lonLatToEstimate(sample, resolution);
    estimates.push({estimate, sample});
  }

  // Deduplicate estimates
  const estimateSet = new Set<bigint>();
  const uniqueEstimates: A5Cell[] = [];
  for (const {estimate, sample} of estimates) {
    const estimateKey = serialize(estimate);
    if (!estimateSet.has(estimateKey)) {
      estimateSet.add(estimateKey);
      uniqueEstimates.push(estimate);
    }
  }

  for (const estimate of uniqueEstimates) {
    const distance = a5cellContainsPoint(estimate, lonLat);
    if (distance > 0) {
      return serialize(estimate);
    } else {
      cells.push({cell: estimate, distance});
    }
  }

  // Sort cells by distance and use the closest one
  cells.sort((a, b) => b.distance - a.distance);
  return serialize(cells[0].cell);
}

// The IJToS function uses the triangular lattice which only approximates the pentagon lattice
// Thus this function only returns an cell nearby, and we need to search the neighbourhood to find the correct cell
// TODO: Implement a more accurate function
function _lonLatToEstimate(lonLat: LonLat, resolution: number): A5Cell {
  const spherical = fromLonLat(lonLat);
  const origin = {...findNearestOrigin(spherical)};

  const polar = unprojectDodecahedron(spherical, origin.quat, origin.angle);
  const dodecPoint = toFace(polar);
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
  const lonLat = projectPoint(pentagon.getCenter() as Face, origin);
  return PentagonShape.normalizeLongitudes([lonLat])[0];
}

export function cellToBoundary(cellId: bigint): LonLat[] {
  const {S, segment, origin, resolution} = deserialize(cellId);
  const pentagon = _getPentagon({S, segment, origin, resolution});
  return projectPentagon(pentagon, origin);
}

function lonLatToCartesian(lonLat: LonLat): Cartesian {
  return toCartesian(fromLonLat(lonLat));
}

export function a5cellContainsPoint(cell: A5Cell, point: LonLat): number {
  const boundary = cellToBoundary(serialize(cell));

  const cartesian = lonLatToCartesian(point);
  const sphericalBoundary = boundary.map(lonLatToCartesian);

  const sphericalPentagon = new SphericalPentagonShape(sphericalBoundary);
  return sphericalPentagon.containsPoint(cartesian);

  // Important to use the same origin as the cell, so we unproject onto correct face
  const {origin} = cell;
  const polar = unprojectDodecahedron(spherical, origin.quat, origin.angle);
  const face = toFace(polar);

  // Required for points on pentagon that cross the origin boundary
  const pentagon = _getPentagon(cell);
  const reprojectedPentagon = reprojectPentagon(pentagon, origin);

  // Perform containment test in Face coordinates, where cell edges are straight lines
  return reprojectedPentagon.containsPoint(face);
}
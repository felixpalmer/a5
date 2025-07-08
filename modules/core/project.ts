// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { vec2, mat2, glMatrix } from 'gl-matrix';
glMatrix.setMatrixArrayType(Float64Array as any);
import { PentagonShape } from './utils';
import { Origin } from './utils';
import { movePointToFace, findNearestOrigin, isNearestOrigin } from './origin';
import { projectDodecahedron, projectDodecahedronGnomonic } from './dodecahedron';
import type { Face, LonLat, Radians } from './coordinate-systems';
import { toCartesian, toLonLat, toPolar } from './coordinate-transforms';
import { PI_OVER_5 } from './constants';

// Reusable matrices to avoid recreation
const rotation = mat2.create();

export function projectPoint(vertex: Face, origin: Origin, resolution: number): LonLat {
  const unwarped = toPolar(vertex);
  const projectedSpherical = projectDodecahedronGnomonic(unwarped, origin.quat, origin.angle);
  const closest = isNearestOrigin(projectedSpherical, origin) ? origin : findNearestOrigin(projectedSpherical);

  let point;
  if (closest.id === origin.id) {
    point = projectDodecahedron(unwarped, origin.quat, origin.angle, resolution);
  } else {
    // Move point to be relative to new origin
    const dodecPoint2 = vec2.create() as Face;
    mat2.fromRotation(rotation, origin.angle);
    vec2.transformMat2(dodecPoint2, vertex, rotation);
    const {point: offsetDodec, quat: interfaceQuat} = movePointToFace(dodecPoint2, origin, closest);

    let angle2: Radians = 0 as Radians;
    if (origin.angle !== closest.angle && closest.angle !== 0) {
      angle2 = -PI_OVER_5 as Radians;
    }

    let polar2 = toPolar(offsetDodec as Face);
    polar2[1] = polar2[1] - angle2 as Radians;

    // Project back to sphere
    point = projectDodecahedron(polar2, interfaceQuat, angle2, resolution);
  }

  return toLonLat(point);
}

export function projectPentagon(pentagon: PentagonShape, origin: Origin, resolution: number): LonLat[] {
  const vertices = pentagon.getVertices();
  const rotatedVertices = vertices.map(vertex => projectPoint(vertex, origin, resolution));

  // Normalize longitudes to handle antimeridian crossing
  const normalizedVertices = PentagonShape.normalizeLongitudes(rotatedVertices);
  return normalizedVertices;
}
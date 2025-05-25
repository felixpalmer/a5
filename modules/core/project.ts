// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { vec2, mat2, glMatrix } from 'gl-matrix';
glMatrix.setMatrixArrayType(Float64Array as any);
import { PentagonShape } from './utils';
import { Origin } from './utils';
import { movePointToFace, findNearestOrigin, isNearestOrigin } from './origin';
import { projectDodecahedron } from './dodecahedron';
import type { Face, LonLat, Polar, Radians } from './coordinate-systems';
import { toLonLat, toPolar } from './coordinate-transforms';
import { PI_OVER_5 } from './constants';

// Reusable matrices to avoid recreation
const rotation = mat2.create();

export function projectPoint(vertex: Face, origin: Origin): LonLat {
  const unwarped = toPolar(vertex);
  const point = projectDodecahedron(unwarped, origin.quat, origin.angle);
  const closest = isNearestOrigin(point, origin) ? origin : findNearestOrigin(point);
  
  if (closest.id !== origin.id) {
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
    const point2 = projectDodecahedron(polar2, interfaceQuat, angle2);
    point[0] = point2[0];
    point[1] = point2[1];
  }

  return toLonLat(point);
}

export function projectPentagon(pentagon: PentagonShape, origin: Origin): LonLat[] {
  const vertices = pentagon.getVertices();
  const rotatedVertices = vertices.map(vertex => projectPoint(vertex, origin));

  // Normalize longitudes to handle antimeridian crossing
  const normalizedVertices = PentagonShape.normalizeLongitudes(rotatedVertices);
  return normalizedVertices;
}

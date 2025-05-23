// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { vec2, mat2, glMatrix } from 'gl-matrix';
glMatrix.setMatrixArrayType(Float64Array as any);
import { fromLonLat, toFace } from '../core/coordinate-transforms';
import type { LonLat, Face } from '../core/coordinate-systems';
import { findNearestOrigin } from '../core/origin';
import { unprojectDodecahedron } from '../core/dodecahedron';
import { PI_OVER_5 } from '../core/constants';

const rotation = mat2.create();
const shift = vec2.create();

export function lonLatToFace(lonLat: LonLat, resolution: number, centroid?: LonLat): Face {
  const spherical = fromLonLat(lonLat);
  let origin;
  if (centroid) {
    origin = {...findNearestOrigin(fromLonLat(centroid))};
  } else {
    origin = {...findNearestOrigin(spherical)};
  }

  const ROTATIONS = [0, 0, 9, 6, 7, 6, 5, 4, 7, 7, 9, 0]; 
  mat2.fromRotation(rotation, ROTATIONS[origin.id] * PI_OVER_5 + origin.angle);

  const polar = unprojectDodecahedron(spherical, origin.quat, origin.angle);
  const dodecPoint = toFace(polar);
  vec2.transformMat2(dodecPoint, dodecPoint, rotation);

  vec2.set(shift, 0, 0);
  const PATH = [0, 0, 1, 2, 5, 2, 3, 2, 9, 2, 3, 4];
  for (let i = 0; i <= origin.id; i++) {
    if (i === 8) {
      // vec2.add(shift, shift, [-3, -3]);
    }
    const _shift = vec2.fromValues(Math.cos(PATH[i] * PI_OVER_5), Math.sin(PATH[i] * PI_OVER_5));
    vec2.scale(_shift, _shift, 1.232);
    vec2.add(shift, shift, _shift);
  }

  vec2.add(dodecPoint, dodecPoint, shift);
  return dodecPoint;
}
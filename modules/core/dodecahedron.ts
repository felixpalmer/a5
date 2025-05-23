// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { vec3, quat, glMatrix } from "gl-matrix";
glMatrix.setMatrixArrayType(Float64Array as any);
import { toCartesian, toSpherical } from "./coordinate-transforms";
import type { Radians, Spherical, Cartesian, Polar } from "./coordinate-systems";
import { unwarpPolar, warpPolar } from './warp';
import { projectGnomonic, unprojectGnomonic } from './gnomonic';

export function projectDodecahedron(unwarped: Polar, originTransform: quat, originRotation: Radians): Spherical {
  // Warp in polar space to minimize area variation across sphere
  const [rho, gamma] = warpPolar(unwarped);

  // Rotate around face axis to match origin rotation
  const polar = [rho, gamma + originRotation] as Polar;

  // Project gnomically onto sphere and obtain cartesian coordinates
  const projectedSpherical = projectGnomonic(polar);
  const projected = toCartesian(projectedSpherical);

  // Rotate to correct orientation on globe and return spherical coordinates
  vec3.transformQuat(projected, projected, originTransform);
  return toSpherical(projected);
}

export function unprojectDodecahedron(spherical: Spherical, originTransform: quat, originRotation: Radians): Polar {
  // Transform back origin space
  const [x, y, z] = toCartesian(spherical);
  const inverseQuat = quat.create();
  quat.invert(inverseQuat, originTransform);
  const out = vec3.create() as Cartesian;
  vec3.transformQuat(out, [x, y, z], inverseQuat);

  // Unproject gnomonically to polar coordinates in origin space
  const projectedSpherical = toSpherical(out);
  const polar = unprojectGnomonic(projectedSpherical);

  // Rotate around face axis to remove origin rotation
  polar[1] = (polar[1] - originRotation) as Radians;

  // Unwarp the polar coordinates to obtain points in lattice space
  return unwarpPolar(polar);
}
// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { vec2, vec3, quat, glMatrix } from "gl-matrix";
glMatrix.setMatrixArrayType(Float64Array as any);
import { toCartesian, toSpherical, toFace, toPolar } from "./coordinate-transforms";
import type { Radians, Spherical, Cartesian, Polar, Face } from "./coordinate-systems";
import { unwarpPolar, warpPolar, normalizeGamma } from './warp';
import { projectGnomonic, unprojectGnomonic } from './gnomonic';
import type { WarpType } from './constants';
import { forwardVector, inverseVector } from "./ivea";
import { getQuintantPolar, getQuintantVertices } from "./tiling";

function getWarpType(resolution: number): WarpType {
  return (resolution < 5) ? 'low' : 'high';
}

type VertexIndex = 0 | 1 | 2;
type VertexOrder = [VertexIndex, VertexIndex, VertexIndex];
const DODECAHEDRON_FACE_CENTER: VertexIndex = 0;
const DODECAHEDRON_VERTEX: VertexIndex = 1;
const DODECAHEDRON_EDGE_MIDPOINT: VertexIndex = 2;

// The first index is always be passed first, the second & third are swapped based on the sign of gamma
const IVEA: VertexOrder = [DODECAHEDRON_FACE_CENTER, DODECAHEDRON_VERTEX, DODECAHEDRON_EDGE_MIDPOINT];
const ISEA: VertexOrder = [DODECAHEDRON_VERTEX, DODECAHEDRON_EDGE_MIDPOINT, DODECAHEDRON_FACE_CENTER];    
const RTEA: VertexOrder = [DODECAHEDRON_EDGE_MIDPOINT, DODECAHEDRON_FACE_CENTER, DODECAHEDRON_VERTEX];    
const VERTEX_ORDER: VertexOrder = IVEA;

type FaceTriangle = [Face, Face, Face];
type SphericalTriangle = [Cartesian, Cartesian, Cartesian];
function getFaceTriangle(polar: Polar): FaceTriangle {
  const quintant = getQuintantPolar(polar);
  const [vCenter, vCorner1, vCorner2] = getQuintantVertices(quintant).getVertices();
  const vEdgeMidpoint = vec2.create() as Face;
  vec2.lerp(vEdgeMidpoint, vCorner1, vCorner2, 0.5);

  // Sign of gamma determines which triangle we want to use, and thus vertex order
  const odd = normalizeGamma(polar[1]) > 0;

  // Note: center & midpoint compared to DGGAL implementation are swapped
  // as we are using a dodecahedron, rather than a icosahedron.
  let facePoints = odd ? [vCenter, vEdgeMidpoint, vCorner1] : [vCenter, vCorner2, vEdgeMidpoint];
  const ia = VERTEX_ORDER[0];
  const ib = VERTEX_ORDER[1];
  const ic = VERTEX_ORDER[2];

  return [facePoints[ia], facePoints[ib], facePoints[ic]] as FaceTriangle; 
}

function getSphericalTriangle(faceTriangle: FaceTriangle, originTransform: quat, originRotation: Radians): SphericalTriangle {
  const sphericalTriangle = faceTriangle.map(face => {
    const [rho, gamma] = toPolar(face as Face);
    const rotatedPolar = [rho, gamma + originRotation] as Polar;
    const rotated = toCartesian(projectGnomonic(rotatedPolar));
    vec3.transformQuat(rotated, rotated, originTransform);
    return rotated;
  });
  return sphericalTriangle as SphericalTriangle;
}

export function projectDodecahedron(unwarped: Polar, originTransform: quat, originRotation: Radians, resolution: number): Spherical {
  //return _projectDodecahedron(unwarped, originTransform, originRotation, resolution);
  let faceTriangle = getFaceTriangle(unwarped);
  let sphericalTriangle = getSphericalTriangle(faceTriangle, originTransform, originRotation);

  const point = toFace(unwarped) as [number, number];
  const unprojected = inverseVector(point, faceTriangle, sphericalTriangle);
  return toSpherical(unprojected);
}

export function unprojectDodecahedron(spherical: Spherical, originTransform: quat, originRotation: Radians, resolution: number): Polar {
  // Transform back origin space
  const unprojected = toCartesian(spherical);
  const inverseQuat = quat.create();
  quat.invert(inverseQuat, originTransform);
  const out = vec3.create() as Cartesian;
  vec3.transformQuat(out, unprojected, inverseQuat);

  // Unproject gnomonically to polar coordinates in origin space
  const projectedSpherical = toSpherical(out);
  const polar = unprojectGnomonic(projectedSpherical);

  // Rotate around face axis to remove origin rotation
  polar[1] = (polar[1] - originRotation) as Radians;

  let faceTriangle = getFaceTriangle(polar);
  let sphericalTriangle = getSphericalTriangle(faceTriangle, originTransform, originRotation);

  const projected = forwardVector(unprojected, sphericalTriangle, faceTriangle) as Face;

  // Unwarp the polar coordinates to obtain points in lattice space
  return toPolar(projected);
}

export function _projectDodecahedron(unwarped: Polar, originTransform: quat, originRotation: Radians, resolution: number): Spherical {
  // Warp in polar space to minimize area variation across sphere
  const [rho, gamma] = warpPolar(unwarped, getWarpType(resolution));

  // Rotate around face axis to match origin rotation
  const polar = [rho, gamma + originRotation] as Polar;

  // Project gnomically onto sphere and obtain cartesian coordinates
  const projectedSpherical = projectGnomonic(polar);
  const projected = toCartesian(projectedSpherical);

  // Rotate to correct orientation on globe and return spherical coordinates
  vec3.transformQuat(projected, projected, originTransform);
  return toSpherical(projected);
}

export function projectDodecahedronGnomonic([rho, gamma]: Polar, originTransform: quat, originRotation: Radians): Spherical {
  // Rotate around face axis to match origin rotation
  const polar = [rho, gamma + originRotation] as Polar;

  // Project gnomically onto sphere and obtain cartesian coordinates
  const projectedSpherical = projectGnomonic(polar);
  const projected = toCartesian(projectedSpherical);

  // Rotate to correct orientation on globe and return spherical coordinates
  vec3.transformQuat(projected, projected, originTransform);
  return toSpherical(projected);
}

export function _unprojectDodecahedron(spherical: Spherical, originTransform: quat, originRotation: Radians, resolution: number): Polar {
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
  return unwarpPolar(polar, getWarpType(resolution));
}
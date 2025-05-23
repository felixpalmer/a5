// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { vec2, quat, glMatrix } from 'gl-matrix';
glMatrix.setMatrixArrayType(Float64Array as any);
import type { Degrees, Radians, Face, Polar, IJ, Cartesian, Spherical, LonLat } from "./coordinate-systems";
import { BASIS_INVERSE, BASIS } from "./pentagon";

export function degToRad(deg: Degrees): Radians {
  return deg * (Math.PI / 180) as Radians;
}
export function radToDeg(rad: Radians): Degrees {
  return rad * (180 / Math.PI) as Degrees;
}

export function toPolar(xy: Face): Polar {
  const rho = vec2.length(xy); // Radial distance from face center
  const gamma = Math.atan2(xy[1], xy[0]) as Radians; // Azimuthal angle
  return [rho, gamma] as Polar;
}

export function toFace([rho, gamma]: Polar): Face {
  const x = rho * Math.cos(gamma);
  const y = rho * Math.sin(gamma);
  return [x, y] as Face;
}

export function FaceToIJ(face: Face): IJ {
  return vec2.transformMat2(vec2.create(), face, BASIS_INVERSE) as IJ;
}

export function IJToFace(ij: IJ): Face {
  return vec2.transformMat2(vec2.create(), ij, BASIS) as Face;
}

export function toSpherical(xyz: Cartesian): Spherical {
  const theta = Math.atan2(xyz[1], xyz[0]);
  const r = Math.sqrt(xyz[0] * xyz[0] + xyz[1] * xyz[1] + xyz[2] * xyz[2]);
  const phi = Math.acos(xyz[2] / r);
  return [theta, phi] as Spherical;
}

export function toCartesian([theta, phi]: Spherical): Cartesian {
  const x = Math.sin(phi) * Math.cos(theta);
  const y = Math.sin(phi) * Math.sin(theta);
  const z = Math.cos(phi);
  return [x, y, z] as Cartesian;
}


/**
 * Determine the offset longitude for the spherical coordinate system
 * This is the angle between the Greenwich meridian and vector between the centers
 * of the first two origins (dodecahedron face centers)
 * 
 * It is chose such that the majority of the world's population, around 99.9% (and thus land mass) is located
 * in the first 8.5 dodecahedron faces, and thus come first along the Hilbert curve.
 */
const LONGITUDE_OFFSET = 93 as Degrees;

/**
 * Convert longitude/latitude to spherical coordinates
 * @param lon Longitude in degrees (0 to 360)
 * @param lat Latitude in degrees (-90 to 90)
 * @returns [theta, phi] in radians
 */
export function fromLonLat([longitude, latitude]: LonLat): Spherical {
  const theta = degToRad(longitude + LONGITUDE_OFFSET as Degrees);
  const phi = degToRad((90 - latitude) as Degrees);
  return [theta, phi] as Spherical;
}

/**
 * Convert spherical coordinates to longitude/latitude
 * @param theta Longitude in radians (0 to 2π)
 * @param phi Colatitude in radians (0 to π)
 * @returns [longitude, latitude] in degrees
 */
export function toLonLat([theta, phi]: Spherical): LonLat {
  const longitude = radToDeg(theta) - LONGITUDE_OFFSET as Degrees;
  const latitude = (90 - radToDeg(phi)) as Degrees;
  return [longitude, latitude] as LonLat;
}

export function quatFromSpherical(axis: Spherical): quat {
  const cartesian = toCartesian(axis);
  const Q = quat.create();
  quat.rotationTo(Q, [0, 0, 1] as Cartesian, cartesian);
  return Q;
}
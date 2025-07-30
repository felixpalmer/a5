// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { vec2, quat, vec3, glMatrix } from 'gl-matrix';
glMatrix.setMatrixArrayType(Float64Array as any);
import type { Degrees, Radians, Face, Polar, IJ, Cartesian, Spherical, LonLat, Barycentric, FaceTriangle } from "./coordinate-systems";
import { BASIS_INVERSE, BASIS } from "./pentagon";
import { AuthalicProjection } from "../projections/authalic";

const authalic = new AuthalicProjection();

export type Contour = LonLat[];

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

/**
 * Convert face coordinates to barycentric coordinates
 */
export function faceToBarycentric(p: Face, [p1, p2, p3]: FaceTriangle): Barycentric {
  const d31: [number, number] = [p1[0] - p3[0], p1[1] - p3[1]];
  const d23: [number, number] = [p3[0] - p2[0], p3[1] - p2[1]];
  const d3p: [number, number] = [p[0] - p3[0], p[1] - p3[1]];
  
  const det = d23[0] * d31[1] - d23[1] * d31[0];
  const b0 = (d23[0] * d3p[1] - d23[1] * d3p[0]) / det;
  const b1 = (d31[0] * d3p[1] - d31[1] * d3p[0]) / det;
  const b2 = 1 - (b0 + b1);
  return [b0, b1, b2] as Barycentric;
}

/**
 * Convert barycentric coordinates to face coordinates
 */
export function barycentricToFace(b: Barycentric, [p1, p2, p3]: FaceTriangle): Face {
  return [
    b[0] * p1[0] + b[1] * p2[0] + b[2] * p3[0],
    b[0] * p1[1] + b[1] * p2[1] + b[2] * p3[1]
  ] as Face;
}

export function toSpherical(xyz: Cartesian): Spherical {
  const theta = Math.atan2(xyz[1], xyz[0]);
  const r = Math.sqrt(xyz[0] * xyz[0] + xyz[1] * xyz[1] + xyz[2] * xyz[2]);
  const phi = Math.acos(xyz[2] / r);
  return [theta, phi] as Spherical;
}

export function toCartesian([theta, phi]: Spherical): Cartesian {
  const sinPhi = Math.sin(phi);
  const x = sinPhi * Math.cos(theta);
  const y = sinPhi * Math.sin(theta);
  const z = Math.cos(phi);
  return [x, y, z] as Cartesian;
}

/**
 * Determine the offset longitude for the spherical coordinate system
 * This is the angle between the Greenwich meridian and vector between the centers
 * of the first two origins (dodecahedron face centers)
 * 
 * It is chosen such that the majority of the world's population, around 99.9% (and thus land mass) is located
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
  
  const geodeticLat = degToRad(latitude as Degrees);
  const authalicLat = authalic.forward(geodeticLat);
  const phi = (Math.PI / 2 - authalicLat) as Radians;
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

  const authalicLat = Math.PI / 2 - phi as Radians;
  const geodeticLat = authalic.inverse(authalicLat);
  const latitude = radToDeg(geodeticLat) as Degrees;
  return [longitude, latitude] as LonLat;
}

/**
 * Normalizes longitude values in a contour to handle antimeridian crossing
 * @param contour Array of [longitude, latitude] points
 * @returns Normalized contour with consistent longitude values
 */
export function normalizeLongitudes(contour: Contour): Contour {
  // Calculate center in Cartesian space to avoid poles & antimeridian crossing issues
  const points = contour.map(lonLat => toCartesian(fromLonLat(lonLat)));
  const center = vec3.create() as Cartesian;
  for (const point of points) {
    vec3.add(center, center, point);
  }
  vec3.normalize(center, center);
  let [centerLon, centerLat] = toLonLat(toSpherical(center));
  if (centerLat > 89.99 || centerLat < -89.99) {
    // Near poles, use first point's longitude
    centerLon = contour[0][0] as Degrees;
  }

  // Normalize center longitude to be in the range -180 to 180
  centerLon = ((centerLon + 180) % 360 + 360) % 360 - 180 as Degrees;
  
  // Normalize each point relative to center
  return contour.map(point => {
    let [longitude, latitude] = point;
    
    // Adjust longitude to be closer to center
    while (longitude - centerLon > 180) longitude = longitude - 360 as Degrees;
    while (longitude - centerLon < -180) longitude = longitude + 360 as Degrees;
    return [longitude, latitude] as LonLat;
  });
}
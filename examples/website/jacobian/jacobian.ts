// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {DodecahedronProjection} from 'a5/projections/dodecahedron';
import {toCartesian, toFace, toPolar} from 'a5/core/coordinate-transforms';
import {distanceToEdge, PI_OVER_5, TWO_PI, TWO_PI_OVER_5} from 'a5/core/constants';
import type {Cartesian, Face, Polar, Radians, Spherical} from 'a5/core/coordinate-systems';
import type {OriginId} from 'a5/core/utils';

const projection = new DodecahedronProjection();

/**
 * The arctic face. Its center projects to the north pole, which keeps the sphere
 * view symmetric about the camera axis.
 */
const ORIGIN_ID = 0 as OriginId;

/** Face center to edge midpoint: the pentagon's apothem */
export const FACE_APOTHEM = distanceToEdge;

/** Face center to corner */
export const FACE_CIRCUMRADIUS = distanceToEdge / Math.cos(PI_OVER_5);

/** Each face is projected as ten triangles; the projection has a cusp at every multiple of this angle */
export const CUSP_SPACING = PI_OVER_5;

/**
 * DSEA projection of a point on the dodecahedron face, taking the face's polar
 * coordinates (rho, gamma) to the sphere's spherical coordinates (theta, phi).
 */
export function polarToSpherical(polar: Polar): Spherical {
  return projection.inverse(toFace(polar), ORIGIN_ID);
}

export function polarToCartesian(polar: Polar): Cartesian {
  return toCartesian(polarToSpherical(polar));
}

/** Inverse of `polarToCartesian`: where a point on the sphere lands on the face */
export function cartesianToPolar(point: Cartesian): Polar {
  return toPolar(projection.forwardCartesian(point, ORIGIN_ID));
}

/** Distance from the face center to the face boundary, in the direction `gamma` */
export function faceRadius(gamma: Radians): number {
  return FACE_APOTHEM / Math.cos(projection.normalizeGamma(gamma));
}

export function isOnFace([rho, gamma]: Polar): boolean {
  return rho <= faceRadius(gamma);
}

/**
 * The Jacobian of the projection at a point, relating the face's polar coordinates
 * (rho, gamma) to the sphere's spherical coordinates (phi, theta).
 *
 * The rows are ordered radial-first (phi, theta) to match the columns
 * (rho, gamma), so that a mapping which introduced no rotation or shear would be
 * diagonal, and the off-diagonal terms read directly as distortion.
 */
export interface Jacobian {
  dPhiDRho: number;
  dPhiDGamma: number;
  dThetaDRho: number;
  dThetaDGamma: number;
  /** Determinant: the area scale factor between the two coordinate charts */
  determinant: number;
  /** sin(phi)·det/rho — the ratio of the *surface* area elements, constant for an equal-area projection */
  areaRatio: number;
}

// Central difference step. Small enough that the O(h²) truncation error stays
// well below the displayed precision, large enough that cancellation in the
// numerator (of order eps/h ≈ 1e-11) does too.
const STEP = 1e-5;

// rho = 0 is the singular point of the polar chart, where gamma is undefined.
// The limit is well defined, so step just off it rather than refusing to answer.
const MIN_RHO = 1e-9;

/** Shortest signed difference between two azimuths, which may straddle ±π */
function wrapAngle(angle: number): number {
  if (angle > Math.PI) return angle - TWO_PI;
  if (angle < -Math.PI) return angle + TWO_PI;
  return angle;
}

export function computeJacobian([rho, gamma]: Polar): Jacobian {
  const r = Math.max(rho, MIN_RHO);
  const h = Math.min(STEP, 0.5 * r);

  const [thetaRhoPlus, phiRhoPlus] = polarToSpherical([r + h, gamma] as Polar);
  const [thetaRhoMinus, phiRhoMinus] = polarToSpherical([r - h, gamma] as Polar);
  const [thetaGammaPlus, phiGammaPlus] = polarToSpherical([r, gamma + h] as Polar);
  const [thetaGammaMinus, phiGammaMinus] = polarToSpherical([r, gamma - h] as Polar);

  const scale = 1 / (2 * h);
  // phi is a colatitude and never wraps; theta is an azimuth, so its differences do
  const dPhiDRho = (phiRhoPlus - phiRhoMinus) * scale;
  const dPhiDGamma = (phiGammaPlus - phiGammaMinus) * scale;
  const dThetaDRho = wrapAngle(thetaRhoPlus - thetaRhoMinus) * scale;
  const dThetaDGamma = wrapAngle(thetaGammaPlus - thetaGammaMinus) * scale;

  const determinant = dPhiDRho * dThetaDGamma - dPhiDGamma * dThetaDRho;

  // Area elements are rho·drho·dgamma on the face and sin(phi)·dphi·dtheta on the
  // sphere, so it is this ratio, not the determinant itself, that the projection
  // holds constant.
  const [, phi] = polarToSpherical([r, gamma] as Polar);
  const areaRatio = (Math.sin(phi) * determinant) / r;

  return {dPhiDRho, dPhiDGamma, dThetaDRho, dThetaDGamma, determinant, areaRatio};
}

/** The five corners of the face, which lie halfway between the edge midpoints */
export function faceCorners(): Face[] {
  const corners: Face[] = [];
  for (let i = 0; i < 5; i++) {
    corners.push(toFace([FACE_CIRCUMRADIUS, PI_OVER_5 + i * TWO_PI_OVER_5] as Polar));
  }
  return corners;
}

/**
 * The face boundary as a closed ring of polar coordinates. The edges are straight
 * on the face but curved on the sphere, hence the subdivision.
 */
export function faceBoundary(segmentsPerEdge = 24): Polar[] {
  const corners = faceCorners();
  const ring: Polar[] = [];
  for (let i = 0; i < 5; i++) {
    const from = corners[i];
    const to = corners[(i + 1) % 5];
    for (let s = 0; s < segmentsPerEdge; s++) {
      const t = s / segmentsPerEdge;
      ring.push(toPolar([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t] as Face));
    }
  }
  ring.push(ring[0]);
  return ring;
}

/** Radii of the polar grid rings. All lie within the apothem, so every ring closes inside the face */
export const GRID_RINGS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6];

/** One ray every 18°, so every second ray falls on a cusp */
export const GRID_RAYS = 20;

export function gridRing(rho: number, segments = 240): Polar[] {
  const ring: Polar[] = [];
  for (let i = 0; i <= segments; i++) {
    ring.push([rho, (TWO_PI * i) / segments] as Polar);
  }
  return ring;
}

export function gridRay(gamma: Radians, segments = 32): Polar[] {
  const ray: Polar[] = [];
  const radius = faceRadius(gamma);
  for (let i = 0; i <= segments; i++) {
    ray.push([(radius * i) / segments, gamma] as Polar);
  }
  return ray;
}

const RAYS_PER_CUSP = Math.round(CUSP_SPACING / (TWO_PI / GRID_RAYS));

/** True for rays that lie on a cusp, where the projection switches face triangle */
export function isCuspRay(index: number): boolean {
  return index % RAYS_PER_CUSP === 0;
}

/**
 * A small patch centered on `polar`, aligned with the polar frame and sized so that
 * it reads as a square of side `size` on the face. Its image on the sphere is the
 * finite version of what the Jacobian describes in the limit.
 */
export function patchOutline(polar: Polar, size: number, segments = 8): Polar[] {
  const [rho, gamma] = polar;
  const dRho = size / 2;
  // Matching arc length in the azimuthal direction, clamped so the patch stays
  // bounded as rho approaches the chart singularity at the face center
  const dGamma = size / 2 / Math.max(rho, size);

  const corners: Polar[] = [
    [Math.max(0, rho - dRho), gamma - dGamma] as Polar,
    [rho + dRho, gamma - dGamma] as Polar,
    [rho + dRho, gamma + dGamma] as Polar,
    [Math.max(0, rho - dRho), gamma + dGamma] as Polar
  ];

  const outline: Polar[] = [];
  for (let i = 0; i < 4; i++) {
    const [rhoA, gammaA] = corners[i];
    const [rhoB, gammaB] = corners[(i + 1) % 4];
    for (let s = 0; s < segments; s++) {
      const t = s / segments;
      outline.push([rhoA + (rhoB - rhoA) * t, gammaA + (gammaB - gammaA) * t] as Polar);
    }
  }
  outline.push(outline[0]);
  return outline;
}

/**
 * Triangle mesh covering the face, tessellated in polar coordinates and projected
 * onto the sphere, so it can be drawn as the image of the face.
 */
export function faceMesh(angularSegments = 160, radialSegments = 12) {
  const positions = new Float32Array((angularSegments + 1) * (radialSegments + 1) * 3);
  let p = 0;
  for (let j = 0; j <= radialSegments; j++) {
    for (let i = 0; i <= angularSegments; i++) {
      const gamma = ((TWO_PI * i) / angularSegments) as Radians;
      const rho = (faceRadius(gamma) * j) / radialSegments;
      const point = polarToCartesian([rho, gamma] as Polar);
      positions[p++] = point[0];
      positions[p++] = point[1];
      positions[p++] = point[2];
    }
  }

  const indices = new Uint32Array(angularSegments * radialSegments * 6);
  let k = 0;
  for (let j = 0; j < radialSegments; j++) {
    for (let i = 0; i < angularSegments; i++) {
      const a = j * (angularSegments + 1) + i;
      const b = a + 1;
      const c = a + angularSegments + 1;
      const d = c + 1;
      indices[k++] = a;
      indices[k++] = c;
      indices[k++] = b;
      indices[k++] = b;
      indices[k++] = c;
      indices[k++] = d;
    }
  }

  return {positions, indices};
}

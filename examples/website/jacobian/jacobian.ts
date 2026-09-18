// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {DodecahedronProjection} from 'a5/projections/dodecahedron';
import {DEFAULT_PROJECTION_MODE} from 'a5/projections/projection-mode';
import type {ProjectionMode} from 'a5/projections/projection-mode';
import {radToDeg, toCartesian, toFace, toPolar} from 'a5/core/coordinate-transforms';
import {AUTHALIC_RADIUS_EARTH, distanceToEdge, PI_OVER_5, TWO_PI, TWO_PI_OVER_5} from 'a5/core/constants';
import * as vec3 from 'a5/math/vec3';
import type {Cartesian, Face, Polar, Radians, Spherical} from 'a5/core/coordinate-systems';
import type {OriginId} from 'a5/core/utils';
import {_getPentagon} from 'a5/core/cell';
import {deserialize} from 'a5/core/serialization';
import {cellToChildren, getRes0Cells} from 'a5/index';

/**
 * Both projections, so the two can be compared without rebuilding anything. They
 * differ only in which vertex of each face triangle the equal-area map radiates
 * from: DSEA the face center, ISEA the dodecahedron corner.
 */
const projections: Record<ProjectionMode, DodecahedronProjection> = {
  dsea: new DodecahedronProjection('dsea'),
  isea: new DodecahedronProjection('isea')
};

export const PROJECTION_MODES: ProjectionMode[] = ['dsea', 'isea'];

/** Only the planar side of the projection is used here, and that is mode independent */
const projection = projections[DEFAULT_PROJECTION_MODE];

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

/** Area of the flat face, for the dodecahedron of inradius 1 that A5 is built on */
export const FACE_AREA = 5 * FACE_APOTHEM * FACE_APOTHEM * Math.tan(PI_OVER_5);

/**
 * Radius at which the sphere's surface area is exactly twelve face areas.
 *
 * A dodecahedron of inradius 1 circumscribes the unit sphere, so its faces are
 * larger than the spherical pentagons they map onto — by a factor of 1.325. The
 * projection is equal-area between the face and *this* sphere, so drawing the
 * sphere at any other radius would make the area check below come out as
 * something other than one.
 */
export const SPHERE_RADIUS = Math.sqrt((3 * FACE_AREA) / Math.PI);

/**
 * DSEA projection of a point on the dodecahedron face, taking the face's polar
 * coordinates (rho, gamma) to the sphere's spherical coordinates (theta, phi).
 */
export function polarToSpherical(polar: Polar, mode: ProjectionMode = DEFAULT_PROJECTION_MODE): Spherical {
  return projections[mode].inverse(toFace(polar), ORIGIN_ID);
}

export function polarToCartesian(polar: Polar, mode: ProjectionMode = DEFAULT_PROJECTION_MODE): Cartesian {
  return toCartesian(polarToSpherical(polar, mode));
}

/** Inverse of `polarToCartesian`: where a point on the sphere lands on the face */
export function cartesianToPolar(point: Cartesian, mode: ProjectionMode = DEFAULT_PROJECTION_MODE): Polar {
  return toPolar(projections[mode].forwardCartesian(point, ORIGIN_ID));
}

/** Distance from the face center to the face boundary, in the direction `gamma` */
export function faceRadius(gamma: Radians): number {
  return FACE_APOTHEM / Math.cos(projection.normalizeGamma(gamma));
}

export function isOnFace([rho, gamma]: Polar): boolean {
  return rho <= faceRadius(gamma);
}

/** Distance from the face center to a mirrored face center, the far point of the domain */
export const DOMAIN_CIRCUMRADIUS = 2 * FACE_APOTHEM;

const TAN_PI_OVER_5 = Math.tan(PI_OVER_5);

/**
 * Distance from the face center to the edge of the projectable domain, in the
 * direction `gamma`.
 *
 * Past the face edge the projection reflects each of its ten triangles across
 * that edge and unprojects onto the neighbouring dodecahedron face. Those ten
 * reflections cover the mirror image of each quintant, so the domain is the face
 * with a triangle erected on every edge: a ten-sided outline alternating between
 * the face corners and the mirrored face centers.
 */
export function domainRadius(gamma: Radians): number {
  const beta = Math.abs(projection.normalizeGamma(gamma));
  return (DOMAIN_CIRCUMRADIUS * TAN_PI_OVER_5) / (TAN_PI_OVER_5 * Math.cos(beta) + Math.sin(beta));
}

export function isInDomain([rho, gamma]: Polar): boolean {
  return rho <= domainRadius(gamma);
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
  /**
   * R²·sin(phi)·det/rho — the ratio of the *surface* area elements. This, rather
   * than the determinant, is what the projection holds constant, and with the
   * sphere at SPHERE_RADIUS it is exactly one.
   */
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

/**
 * Move gamma clear of the nearest cusp, where the projection switches face
 * triangle and the derivative jumps.
 */
function stepClearOfCusp(gamma: Radians, margin: number): Radians {
  const cusp = CUSP_SPACING * Math.round(gamma / CUSP_SPACING);
  const offset = gamma - cusp;
  if (Math.abs(offset) >= margin) return gamma;
  return (cusp + (offset < 0 ? -margin : margin)) as Radians;
}

/**
 * Move rho clear of the face edge, where the projection starts reflecting onto a
 * neighbouring face and the derivative jumps. The margin also has to cover how
 * far the edge itself moves across the gamma stencil, which is at most 0.56 of a
 * step, hence three rather than two.
 */
function stepClearOfEdge(rho: number, gamma: Radians, margin: number): number {
  const edge = faceRadius(gamma);
  if (Math.abs(rho - edge) >= margin) return rho;
  return rho <= edge ? edge - margin : edge + margin;
}

export function computeJacobian([rho, gamma]: Polar, mode: ProjectionMode = DEFAULT_PROJECTION_MODE): Jacobian {
  const r0 = Math.max(rho, MIN_RHO);
  const h = Math.min(STEP, 0.5 * r0);

  // Step the stencil off the two places the derivative jumps, so that it reports
  // the one-sided derivative on the point's own side rather than averaging both.
  // Straddling a jump is not a small error: at the face edge it puts a spurious
  // rotation of over a degree into an interior where there is none at all. The
  // shift is a few multiples of STEP, far below the precision displayed.
  const g = stepClearOfCusp(gamma, 2 * h);
  const r = stepClearOfEdge(r0, g, 3 * h);

  const [thetaRhoPlus, phiRhoPlus] = polarToSpherical([r + h, g] as Polar, mode);
  const [thetaRhoMinus, phiRhoMinus] = polarToSpherical([r - h, g] as Polar, mode);
  const [thetaGammaPlus, phiGammaPlus] = polarToSpherical([r, g + h] as Polar, mode);
  const [thetaGammaMinus, phiGammaMinus] = polarToSpherical([r, g - h] as Polar, mode);

  const scale = 1 / (2 * h);
  // phi is a colatitude and never wraps; theta is an azimuth, so its differences do
  const dPhiDRho = (phiRhoPlus - phiRhoMinus) * scale;
  const dPhiDGamma = (phiGammaPlus - phiGammaMinus) * scale;
  const dThetaDRho = wrapAngle(thetaRhoPlus - thetaRhoMinus) * scale;
  const dThetaDGamma = wrapAngle(thetaGammaPlus - thetaGammaMinus) * scale;

  const determinant = dPhiDRho * dThetaDGamma - dPhiDGamma * dThetaDRho;

  // Area elements are rho·drho·dgamma on the face and R²·sin(phi)·dphi·dtheta on
  // the sphere. Neither chart is area-preserving on its own, which is why the
  // determinant varies across the face while this ratio does not.
  const [, phi] = polarToSpherical([r, g] as Polar, mode);
  const areaRatio = (SPHERE_RADIUS * SPHERE_RADIUS * Math.sin(phi) * determinant) / r;

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

/** The ten corners of the domain, alternating mirrored face center and face corner */
export function domainCorners(): Face[] {
  const corners: Face[] = [];
  for (let i = 0; i < 5; i++) {
    corners.push(toFace([DOMAIN_CIRCUMRADIUS, i * TWO_PI_OVER_5] as Polar));
    corners.push(toFace([FACE_CIRCUMRADIUS, PI_OVER_5 + i * TWO_PI_OVER_5] as Polar));
  }
  return corners;
}

/**
 * A closed ring through the given corners. The edges are straight on the face but
 * curved on the sphere, hence the subdivision.
 */
function boundaryThrough(corners: Face[], segmentsPerEdge: number): Polar[] {
  const ring: Polar[] = [];
  for (let i = 0; i < corners.length; i++) {
    const from = corners[i];
    const to = corners[(i + 1) % corners.length];
    for (let s = 0; s < segmentsPerEdge; s++) {
      const t = s / segmentsPerEdge;
      ring.push(toPolar([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t] as Face));
    }
  }
  ring.push(ring[0]);
  return ring;
}

export function faceBoundary(segmentsPerEdge = 24): Polar[] {
  return boundaryThrough(faceCorners(), segmentsPerEdge);
}

export function domainBoundary(segmentsPerEdge = 24): Polar[] {
  return boundaryThrough(domainCorners(), segmentsPerEdge);
}

/**
 * Radii of the polar grid rings. Those out to the face circumradius close on
 * themselves; beyond it a ring survives only inside the five reflected points.
 */
export const GRID_RINGS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1];

/** One spoke every 4.5°, so every eighth falls on a cusp and every fourth on a triangle bisector */
export const GRID_RAYS = 80;

/**
 * A constant-rho ring, split into the arcs that stay inside the domain. Rings out
 * to the face circumradius come back as a single closed arc, beyond that as one
 * arc per reflected point.
 */
export function gridRingArcs(rho: number, segments = 720): Polar[][] {
  const angle = (i: number) => ((TWO_PI * i) / segments) as Radians;

  if (rho <= FACE_CIRCUMRADIUS) {
    const ring: Polar[] = [];
    for (let i = 0; i <= segments; i++) ring.push([rho, angle(i)] as Polar);
    return [ring];
  }

  const inside: boolean[] = new Array(segments);
  for (let i = 0; i < segments; i++) inside[i] = rho <= domainRadius(angle(i));

  // Walk from a gap, so that an arc straddling gamma = 0 is not cut in two
  const start = inside.indexOf(false);
  if (start < 0) return [];

  const arcs: Polar[][] = [];
  let current: Polar[] | null = null;
  for (let k = 0; k < segments; k++) {
    const i = (start + k) % segments;
    if (!inside[i]) {
      current = null;
      continue;
    }
    if (!current) {
      current = [];
      arcs.push(current);
    }
    current.push([rho, angle(i)] as Polar);
  }
  return arcs;
}

/** A ray from the face center out to the edge of the domain */
export function gridRay(gamma: Radians, segments = 32): Polar[] {
  const ray: Polar[] = [];
  const radius = domainRadius(gamma);
  for (let i = 0; i <= segments; i++) {
    ray.push([(radius * i) / segments, gamma] as Polar);
  }
  return ray;
}

const RAYS_PER_CUSP = Math.round(CUSP_SPACING / (TWO_PI / GRID_RAYS));
const RAYS_PER_BISECTOR = RAYS_PER_CUSP / 2;

/**
 * How prominently a spoke is drawn: those on a cusp, where the projection
 * switches face triangle, then those bisecting a triangle, then the rest.
 */
export type RayWeight = 'cusp' | 'bisector' | 'minor';

export function rayWeight(index: number): RayWeight {
  if (index % RAYS_PER_CUSP === 0) return 'cusp';
  if (index % RAYS_PER_BISECTOR === 0) return 'bisector';
  return 'minor';
}

/**
 * A small patch centered on `polar`, aligned with the polar frame and sized so that
 * it reads as a square of side `size` on the face. Its image on the sphere is the
 * finite version of what the Jacobian describes in the limit.
 */
export function patchOutline(polar: Polar, size: number, segments = 16): Polar[] {
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
      const gammaT = (gammaA + (gammaB - gammaA) * t) as Radians;
      // Clip to the domain. Past it the projection saturates at a triangle vertex,
      // which would collapse the patch rather than simply cutting it off
      const rhoT = Math.min(rhoA + (rhoB - rhoA) * t, domainRadius(gammaT));
      outline.push([rhoT, gammaT] as Polar);
    }
  }
  outline.push(outline[0]);
  return outline;
}

/**
 * Triangle mesh over an annular band of the domain, tessellated in polar
 * coordinates and projected onto the sphere, so the image of the face and the
 * image of the reflected region can each be drawn.
 *
 * angularSegments must be a multiple of ten, so that samples land exactly on the
 * face corners and the mirrored centers, where both radii have a kink.
 */
export function radialMesh(
  innerRadius: (gamma: Radians) => number,
  outerRadius: (gamma: Radians) => number,
  mode: ProjectionMode = DEFAULT_PROJECTION_MODE,
  angularSegments = 160,
  radialSegments = 12
) {
  const positions = new Float32Array((angularSegments + 1) * (radialSegments + 1) * 3);
  let p = 0;
  for (let j = 0; j <= radialSegments; j++) {
    for (let i = 0; i <= angularSegments; i++) {
      const gamma = ((TWO_PI * i) / angularSegments) as Radians;
      const inner = innerRadius(gamma);
      const rho = inner + ((outerRadius(gamma) - inner) * j) / radialSegments;
      const point = polarToCartesian([rho, gamma] as Polar, mode);
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

const ZERO = () => 0;

/** The face itself */
export function faceMesh(mode: ProjectionMode = DEFAULT_PROJECTION_MODE) {
  return radialMesh(ZERO, faceRadius, mode);
}

/** The reflected region: the five triangles mirrored across the face edges */
export function beyondFaceMesh(mode: ProjectionMode = DEFAULT_PROJECTION_MODE) {
  return radialMesh(faceRadius, domainRadius, mode);
}

/**
 * Which pair of frames the derivative is expressed in.
 *
 * 'chart' differentiates the raw coordinates, (rho, gamma) -> (phi, theta). Both
 * charts are centred on this face, so reflecting across a face edge is not a
 * symmetry of either: the reflected region's numbers are a mirror of the face's
 * only after the chart's own contribution is removed.
 *
 * 'metric' removes it, by using the local orthonormal frames instead —
 * (drho, rho·dgamma) on the plane and (R·dphi, R·sinphi·dtheta) on the sphere.
 * Its singular values do not depend on either chart, so they are the projection's
 * own distortion, and they do mirror exactly across a face edge.
 */
export type FrameMode = 'chart' | 'metric';

export interface FrameJacobian {
  mode: FrameMode;
  /** Row 0 is the radial output direction and row 1 the azimuthal; columns likewise for the input */
  rows: [[number, number], [number, number]];
  determinant: number;
  /** Ratio of the surface area elements. Exactly 1 for an equal-area projection */
  areaRatio: number;
}

export function toFrame(
  jacobian: Jacobian,
  polar: Polar,
  mode: FrameMode,
  projectionMode: ProjectionMode = DEFAULT_PROJECTION_MODE
): FrameJacobian {
  if (mode === 'chart') {
    return {
      mode,
      rows: [
        [jacobian.dPhiDRho, jacobian.dPhiDGamma],
        [jacobian.dThetaDRho, jacobian.dThetaDGamma]
      ],
      determinant: jacobian.determinant,
      areaRatio: jacobian.areaRatio
    };
  }

  // Scale each row by the length its coordinate measures on the sphere, and each
  // column by the length its coordinate measures on the plane
  const rho = Math.max(polar[0], 1e-9);
  const [, phi] = polarToSpherical(polar, projectionMode);
  const radial = SPHERE_RADIUS;
  const azimuthal = SPHERE_RADIUS * Math.sin(phi);
  const rows: [[number, number], [number, number]] = [
    [radial * jacobian.dPhiDRho, (radial * jacobian.dPhiDGamma) / rho],
    [azimuthal * jacobian.dThetaDRho, (azimuthal * jacobian.dThetaDGamma) / rho]
  ];
  const determinant = rows[0][0] * rows[1][1] - rows[0][1] * rows[1][0];
  // In these frames the determinant already is the ratio of the area elements
  return {mode, rows, determinant, areaRatio: determinant};
}

/**
 * The derivative split into the three deformations it performs, via the polar
 * decomposition = Rotation · Stretch with Stretch symmetric.
 *
 * Note that the Gram-Schmidt decomposition (J = Rotation · Shear · Scale) is not
 * useful here: the projection radiates from the face center, so rays of constant
 * gamma map to meridians of constant theta, dtheta/drho is identically zero on the
 * face, and that rotation is therefore always zero. The closest *rigid* rotation,
 * which is what the polar decomposition returns, is not.
 */
export interface Decomposition {
  /** Angle taking the frame's radial axis onto its image, in radians */
  rotation: number;
  /** Residual shear, once the rotation, squash and scale are taken out */
  shear: number;
  /** Unequal scaling of the two axes: radial by this, azimuthal by its reciprocal */
  squash: number;
  /** Area scale, sqrt|det| */
  scale: number;
  /** Scale along the image of the radial axis, and across it */
  radial: number;
  azimuthal: number;
}

export function decompose({rows, determinant}: FrameJacobian): Decomposition {
  const [[a, b], [c, d]] = rows;

  // Gram-Schmidt on the columns. The first column alone fixes the rotation and
  // the radial scale; the second then splits into the azimuthal scale and what
  // is left over, the shear.
  const radial = Math.hypot(a, c);
  const azimuthal = radial === 0 ? 0 : determinant / radial;

  // Wherever the matrix is diagonal in this frame the projection can only scale
  // the two axes against each other, and both the rotation and the shear vanish.
  // That happens along every cusp ray, each of which is a mirror line of the
  // pentagon: reflection symmetry pins the principal axes to the frame.
  return {
    rotation: Math.atan2(c, a),
    shear: determinant === 0 ? 0 : (a * b + c * d) / determinant,
    squash: azimuthal === 0 ? Infinity : Math.sqrt(Math.abs(radial / azimuthal)),
    scale: Math.sqrt(Math.abs(determinant)),
    radial,
    azimuthal
  };
}

export type DeformationChannel = 'rotation' | 'shear' | 'squash';

/**
 * Channel order is also the RGB order of the raster. The area scale is left out:
 * in the intrinsic frame it is 1 everywhere, and in the chart frame its variation
 * is the charts' rather than the projection's.
 */
export const DEFORMATION_CHANNELS: DeformationChannel[] = ['rotation', 'shear', 'squash'];

export interface DeformationField {
  size: number;
  /** Magnitude per pixel, row-major over the domain's bounding box with row 0 at maximum y */
  values: Record<DeformationChannel, Float32Array>;
  /**
   * Range of each quantity used to normalise it for display, symmetric about
   * zero. Robust rather than exact: see `symmetricRange`.
   */
  ranges: Record<DeformationChannel, [number, number]>;
  /** True where a channel is constant, so nothing should be read into its variation */
  constant: Record<DeformationChannel, boolean>;
  /** Non-zero for pixels that lie within the domain */
  mask: Uint8Array;
}

/**
 * Samples the decomposition across the domain, so the three deformations can be
 * drawn as a raster. See `deformationMagnitudes` for what is plotted.
 */
/**
 * What the raster and the gauges plot for each quantity, **signed**.
 *
 * The sign is the point: rotation and shear both flip across a cusp, so a cusp
 * shows up as a jump from one extreme to the other. Plotting magnitudes hid that
 * — the two sides of a cusp came out identical. The squash is a ratio about one,
 * so its signed deviation from one is what is plotted.
 */
export function deformationValues(decomposition: Decomposition): Record<DeformationChannel, number> {
  return {
    rotation: radToDeg(decomposition.rotation as Radians),
    shear: decomposition.shear,
    squash: decomposition.squash - 1
  };
}

/** Fraction trimmed from each end before taking a channel's display range */
const RANGE_TRIM = 0.01;

/** A channel whose spread is this small relative to its size carries no signal */
const CONSTANT_TOLERANCE = 1e-6;

/**
 * The range to normalise a quantity over: symmetric about zero, so that the
 * diverging colour ramp puts zero at its midpoint and equal and opposite values
 * read as equally strong in opposite directions.
 *
 * The extreme one percent is ignored. Central differences are meaningless within
 * a step of a cusp or of the face edge, and those few pixels would otherwise
 * stretch the range and flatten everything else. A quantity that is constant up
 * to that differencing error is reported as such, so its noise is not amplified.
 */
function symmetricRange(sortedMagnitudes: Float32Array): {range: [number, number]; constant: boolean} {
  const count = sortedMagnitudes.length;
  if (count === 0) return {range: [0, 0], constant: true};

  const extent = sortedMagnitudes[Math.ceil((1 - RANGE_TRIM) * (count - 1))];
  const constant = extent <= CONSTANT_TOLERANCE * (1 + Math.abs(extent));
  return {range: constant ? [0, 0] : [-extent, extent], constant};
}

export function deformationField(
  size: number,
  mode: FrameMode,
  projectionMode: ProjectionMode = DEFAULT_PROJECTION_MODE
): DeformationField {
  const pixels = size * size;
  const values: Record<DeformationChannel, Float32Array> = {
    rotation: new Float32Array(pixels),
    shear: new Float32Array(pixels),
    squash: new Float32Array(pixels)
  };
  const mask = new Uint8Array(pixels);

  // Masked values only, packed, for the range pass below
  const samples: Record<DeformationChannel, Float32Array> = {
    rotation: new Float32Array(pixels),
    shear: new Float32Array(pixels),
    squash: new Float32Array(pixels)
  };
  let sampleCount = 0;

  for (let j = 0; j < size; j++) {
    const y = DOMAIN_CIRCUMRADIUS - ((j + 0.5) / size) * 2 * DOMAIN_CIRCUMRADIUS;
    for (let i = 0; i < size; i++) {
      const x = -DOMAIN_CIRCUMRADIUS + ((i + 0.5) / size) * 2 * DOMAIN_CIRCUMRADIUS;
      const polar = [Math.hypot(x, y), Math.atan2(y, x)] as Polar;
      if (!isInDomain(polar)) continue;

      const index = j * size + i;
      mask[index] = 1;

      const signed = deformationValues(
        decompose(toFrame(computeJacobian(polar, projectionMode), polar, mode, projectionMode))
      );

      for (let c = 0; c < DEFORMATION_CHANNELS.length; c++) {
        const channel = DEFORMATION_CHANNELS[c];
        values[channel][index] = signed[channel];
        // The range is symmetric, so only the magnitude is needed to find it
        samples[channel][sampleCount] = Math.abs(signed[channel]);
      }
      sampleCount++;
    }
  }

  const ranges = {} as Record<DeformationChannel, [number, number]>;
  const constant = {} as Record<DeformationChannel, boolean>;
  for (let c = 0; c < DEFORMATION_CHANNELS.length; c++) {
    const channel = DEFORMATION_CHANNELS[c];
    const sorted = samples[channel].slice(0, sampleCount).sort();
    const result = symmetricRange(sorted);
    ranges[channel] = result.range;
    constant[channel] = result.constant;
  }

  return {size, values, ranges, constant, mask};
}

/** Resolutions offered for the cell overlay. Enough to show the pattern without crowding the face */
export const CELL_RESOLUTIONS = [2, 3, 4] as const;

/**
 * The A5 cells of one dodecahedron face, as planar pentagons in face coordinates.
 *
 * The lattice is projection independent, so these are the same under either mode —
 * only their images on the sphere differ. Drawing them shows which of the
 * projection's non-smooth loci a cell boundary can actually reach: never a
 * quintant boundary, which cells only abut, but the quintant bisectors and the
 * face edge both.
 */
export function faceCells(resolution: number): Face[][] {
  const out: Face[][] = [];
  for (const res0 of getRes0Cells()) {
    if (deserialize(res0).origin.id !== ORIGIN_ID) continue;
    for (const cell of cellToChildren(res0, resolution)) {
      out.push(_getPentagon(deserialize(cell)).getVertices() as Face[]);
    }
  }
  return out;
}

/**
 * A cell outline as polar coordinates, subdivided so that its image on the sphere
 * stays smooth along each straight planar edge.
 */
export function cellOutline(vertices: Face[], segmentsPerEdge = 8): Polar[] {
  const ring: Polar[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const from = vertices[i];
    const to = vertices[(i + 1) % vertices.length];
    for (let s = 0; s < segmentsPerEdge; s++) {
      const t = s / segmentsPerEdge;
      ring.push(toPolar([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t] as Face));
    }
  }
  ring.push(ring[0]);
  return ring;
}

/**
 * Statistics of the projected cell edges.
 *
 * Lengths are on the unit sphere scaled to Earth's authalic radius, which is where
 * A5's cells actually live — SPHERE_RADIUS is bookkeeping for the Jacobian only,
 * not the sphere the cells are on.
 */
export interface EdgeMetrics {
  edges: number;
  /** Arc length of the projected edge, treated as a curve rather than a chord */
  minKm: number;
  maxKm: number;
  meanKm: number;
  /** Coefficient of variation of the edge lengths */
  spread: number;
  /** Greatest angular departure from the great circle through the endpoints */
  bowingMeanDeg: number;
  bowingMaxDeg: number;
  /**
   * Total area between the cell edges and the great circles joining their
   * vertices, as a fraction of the face. One number for what the projection
   * costs in cell shape.
   */
  sagAreaFraction: number;
}

function faceToCartesian(face: Face, mode: ProjectionMode): Cartesian {
  return toCartesian(projections[mode].inverse(face, ORIGIN_ID));
}

/** 2·asin(chord/2) keeps full precision on short arcs, which acos(dot) does not */
function greatCircle(a: Cartesian, b: Cartesian): number {
  return 2 * Math.asin(Math.min(1, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / 2));
}

// A polyline underestimates arc length by O(h²), so two passes and a Richardson
// step. At 16 the result is within 1e-9 of the same calculation at 512.
const LENGTH_STEPS = 16;
const BOWING_STEPS = 64;

function edgeLength(from: Face, to: Face, mode: ProjectionMode): number {
  const walk = (steps: number) => {
    let total = 0;
    let previous = faceToCartesian(from, mode);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const next = faceToCartesian([from[0] + t * (to[0] - from[0]), from[1] + t * (to[1] - from[1])] as Face, mode);
      total += greatCircle(previous, next);
      previous = next;
    }
    return total;
  };
  return (4 * walk(2 * LENGTH_STEPS) - walk(LENGTH_STEPS)) / 3;
}

/**
 * How far the projected edge strays from the great circle joining its endpoints —
 * the sagitta, as an angle. Zero would mean the edge is exactly a great circle.
 */
function edgeBowing(from: Face, to: Face, mode: ProjectionMode): {worst: number; meanOffset: number} {
  const a = faceToCartesian(from, mode);
  const b = faceToCartesian(to, mode);
  const normal = vec3.create() as Cartesian;
  vec3.cross(normal, a, b);
  const length = vec3.length(normal);
  if (!(length > 1e-15)) return {worst: 0, meanOffset: 0};

  let worst = 0;
  let total = 0;
  for (let i = 1; i < BOWING_STEPS; i++) {
    const t = i / BOWING_STEPS;
    const p = faceToCartesian([from[0] + t * (to[0] - from[0]), from[1] + t * (to[1] - from[1])] as Face, mode);
    const offset = Math.abs(Math.asin(vec3.dot(p, normal) / length));
    total += offset;
    if (offset > worst) worst = offset;
  }
  // The band area is the integral of the offset along the edge, so its mean
  // times the edge length; the endpoints contribute zero offset
  return {worst, meanOffset: total / (BOWING_STEPS + 1)};
}

export function cellEdgeMetrics(cells: Face[][], mode: ProjectionMode): EdgeMetrics | null {
  if (!cells.length) return null;

  let count = 0;
  let total = 0;
  let totalSquared = 0;
  let min = Infinity;
  let max = -Infinity;
  let bowingTotal = 0;
  let bowingMax = 0;
  let sagArea = 0;

  for (let c = 0; c < cells.length; c++) {
    const cell = cells[c];
    for (let i = 0; i < cell.length; i++) {
      const from = cell[i];
      const to = cell[(i + 1) % cell.length];
      const length = edgeLength(from, to, mode);
      count++;
      total += length;
      totalSquared += length * length;
      if (length < min) min = length;
      if (length > max) max = length;

      const bowing = edgeBowing(from, to, mode);
      bowingTotal += bowing.worst;
      if (bowing.worst > bowingMax) bowingMax = bowing.worst;
      sagArea += bowing.meanOffset * length;
    }
  }

  const mean = total / count;
  const variance = Math.max(0, totalSquared / count - mean * mean);
  const toKm = AUTHALIC_RADIUS_EARTH / 1000;
  return {
    edges: count,
    minKm: min * toKm,
    maxKm: max * toKm,
    meanKm: mean * toKm,
    spread: Math.sqrt(variance) / mean,
    bowingMeanDeg: radToDeg((bowingTotal / count) as Radians),
    bowingMaxDeg: radToDeg(bowingMax as Radians),
    sagAreaFraction: sagArea / ((4 * Math.PI) / 12)
  };
}

export interface SagGeometry {
  /** Triangle strip filling the gap between each great circle and its cell edge */
  positions: Float32Array;
  indices: Uint32Array;
}

const SAG_SAMPLES = 12;

/**
 * The gap between each projected cell edge and the great circle joining the same
 * two vertices — the sag, as a fillable band, at true scale.
 */
export function cellSagGeometry(cells: Face[][], mode: ProjectionMode, radius: number): SagGeometry {
  const edges = cells.reduce((total, cell) => total + cell.length, 0);
  const perEdge = SAG_SAMPLES + 1;
  const positions = new Float32Array(edges * perEdge * 2 * 3);
  const indices = new Uint32Array(edges * SAG_SAMPLES * 6);

  const normal = vec3.create() as Cartesian;
  let p = 0;
  let k = 0;
  let edge = 0;

  for (let c = 0; c < cells.length; c++) {
    const cell = cells[c];
    for (let i = 0; i < cell.length; i++) {
      const from = cell[i];
      const to = cell[(i + 1) % cell.length];
      const a = faceToCartesian(from, mode);
      const b = faceToCartesian(to, mode);
      vec3.cross(normal, a, b);
      const length = vec3.length(normal);
      if (length > 1e-15) vec3.scale(normal, normal, 1 / length);

      const base = edge * perEdge * 2;
      for (let s = 0; s <= SAG_SAMPLES; s++) {
        const t = s / SAG_SAMPLES;
        const point = faceToCartesian([from[0] + t * (to[0] - from[0]), from[1] + t * (to[1] - from[1])] as Face, mode);

        // Split the point into its position along the great circle and its offset
        // from it; the foot is where the ideal edge would run
        const offset = length > 1e-15 ? vec3.dot(point, normal) : 0;
        const foot = vec3.create() as Cartesian;
        vec3.scaleAndAdd(foot, point, normal, -offset);
        vec3.normalize(foot, foot);

        positions[p++] = foot[0] * radius;
        positions[p++] = foot[1] * radius;
        positions[p++] = foot[2] * radius;
        positions[p++] = point[0] * radius;
        positions[p++] = point[1] * radius;
        positions[p++] = point[2] * radius;

        if (s > 0) {
          const previous = base + (s - 1) * 2;
          const current = base + s * 2;
          indices[k++] = previous;
          indices[k++] = previous + 1;
          indices[k++] = current;
          indices[k++] = current;
          indices[k++] = previous + 1;
          indices[k++] = current + 1;
        }
      }
      edge++;
    }
  }

  return {positions, indices};
}

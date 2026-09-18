// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {DodecahedronProjection} from 'a5/projections/dodecahedron';
import {radToDeg, toCartesian, toFace, toPolar} from 'a5/core/coordinate-transforms';
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

export function computeJacobian([rho, gamma]: Polar): Jacobian {
  const r0 = Math.max(rho, MIN_RHO);
  const h = Math.min(STEP, 0.5 * r0);

  // Step the stencil off the two places the derivative jumps, so that it reports
  // the one-sided derivative on the point's own side rather than averaging both.
  // Straddling a jump is not a small error: at the face edge it puts a spurious
  // rotation of over a degree into an interior where there is none at all. The
  // shift is a few multiples of STEP, far below the precision displayed.
  const g = stepClearOfCusp(gamma, 2 * h);
  const r = stepClearOfEdge(r0, g, 3 * h);

  const [thetaRhoPlus, phiRhoPlus] = polarToSpherical([r + h, g] as Polar);
  const [thetaRhoMinus, phiRhoMinus] = polarToSpherical([r - h, g] as Polar);
  const [thetaGammaPlus, phiGammaPlus] = polarToSpherical([r, g + h] as Polar);
  const [thetaGammaMinus, phiGammaMinus] = polarToSpherical([r, g - h] as Polar);

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
  const [, phi] = polarToSpherical([r, g] as Polar);
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

const ZERO = () => 0;

/** The face itself */
export function faceMesh() {
  return radialMesh(ZERO, faceRadius);
}

/** The reflected region: the five triangles mirrored across the face edges */
export function beyondFaceMesh() {
  return radialMesh(faceRadius, domainRadius);
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

export function toFrame(jacobian: Jacobian, polar: Polar, mode: FrameMode): FrameJacobian {
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
  const [, phi] = polarToSpherical(polar);
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
   * Range of each channel used to normalise it for display. Robust rather than
   * exact: see `robustRange`.
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
 * What the raster and the gauges plot for each channel. Rotation and shear both
 * change sign across every cusp and the sign carries nothing the picture needs,
 * so they are taken unsigned; the squash is a ratio about 1 and is plotted as it
 * is, so that compression and stretching read as dark and bright.
 */
export function deformationMagnitudes(decomposition: Decomposition): Record<DeformationChannel, number> {
  return {
    rotation: Math.abs(radToDeg(decomposition.rotation as Radians)),
    shear: Math.abs(decomposition.shear),
    squash: decomposition.squash
  };
}

/** Fraction trimmed from each end before taking a channel's display range */
const RANGE_TRIM = 0.01;

/** A channel whose spread is this small relative to its size carries no signal */
const CONSTANT_TOLERANCE = 1e-6;

/**
 * The range to normalise a channel over, ignoring the extreme one percent at each
 * end. Central differences are meaningless within a step of a cusp or of the face
 * edge, and those few pixels would otherwise stretch the range and flatten
 * everything else. A channel that is constant up to that differencing error is
 * reported as such, so that its noise is not amplified into a full range image.
 */
function robustRange(sorted: Float32Array): {range: [number, number]; constant: boolean} {
  const count = sorted.length;
  if (count === 0) return {range: [0, 0], constant: true};

  const low = sorted[Math.floor(RANGE_TRIM * (count - 1))];
  const high = sorted[Math.ceil((1 - RANGE_TRIM) * (count - 1))];
  const span = high - low;
  const constant = span <= CONSTANT_TOLERANCE * (1 + Math.abs(high));
  return {range: constant ? [high, high] : [low, high], constant};
}

export function deformationField(size: number, mode: FrameMode): DeformationField {
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

      const magnitudes = deformationMagnitudes(decompose(toFrame(computeJacobian(polar), polar, mode)));

      for (let c = 0; c < DEFORMATION_CHANNELS.length; c++) {
        const channel = DEFORMATION_CHANNELS[c];
        const magnitude = magnitudes[channel];
        values[channel][index] = magnitude;
        samples[channel][sampleCount] = magnitude;
      }
      sampleCount++;
    }
  }

  const ranges = {} as Record<DeformationChannel, [number, number]>;
  const constant = {} as Record<DeformationChannel, boolean>;
  for (let c = 0; c < DEFORMATION_CHANNELS.length; c++) {
    const channel = DEFORMATION_CHANNELS[c];
    const sorted = samples[channel].slice(0, sampleCount).sort();
    const result = robustRange(sorted);
    ranges[channel] = result.range;
    constant[channel] = result.constant;
  }

  return {size, values, ranges, constant, mask};
}

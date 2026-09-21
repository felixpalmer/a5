// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {DodecahedronProjection} from 'a5/projections/dodecahedron';
import {DEFAULT_PROJECTION_MODE} from 'a5/projections/projection-mode';
import type {ProjectionMode} from 'a5/projections/projection-mode';
import {radToDeg, toCartesian, toFace, toPolar, toSpherical} from 'a5/core/coordinate-transforms';
import {AUTHALIC_RADIUS_EARTH, distanceToEdge, PI_OVER_5, TWO_PI, TWO_PI_OVER_5} from 'a5/core/constants';
import * as vec3 from 'a5/math/vec3';
import type {Cartesian, Face, Polar, Radians, Spherical} from 'a5/core/coordinate-systems';
import type {OriginId} from 'a5/core/utils';
import {findNearestOrigin, origins} from 'a5/core/origin';
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
  isea: new DodecahedronProjection('isea'),
  rtsea: new DodecahedronProjection('rtsea'),
  gnomonic: new DodecahedronProjection('gnomonic')
};

export const PROJECTION_MODES: ProjectionMode[] = ['dsea', 'isea', 'rtsea', 'gnomonic'];

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
  if (needsUnfolding(polar, mode)) {
    const {origin, face} = unfold(polar);
    return projections[mode].inverse(face, origin);
  }
  return projections[mode].inverse(toFace(polar), ORIGIN_ID);
}

export function polarToCartesian(polar: Polar, mode: ProjectionMode = DEFAULT_PROJECTION_MODE): Cartesian {
  return toCartesian(polarToSpherical(polar, mode));
}

/**
 * Spherical coordinates measured about a given face's own centre, rather than the
 * global frame. For the central face these agree, since its centre is the pole.
 */
function sphericalAbout(cartesian: Cartesian, origin: OriginId): Spherical {
  const rotated = vec3.create() as Cartesian;
  vec3.transformQuat(rotated, cartesian, origins[origin].inverseQuat);
  const [theta, phi] = toSpherical(rotated);
  return [(theta - origins[origin].angle) as Radians, phi] as Spherical;
}

/** The reverse: where a point of a face's own spherical frame sits globally */
function cartesianAbout(theta: number, phi: number, origin: OriginId): Cartesian {
  const local = toCartesian([(theta + origins[origin].angle) as Radians, phi as Radians] as Spherical);
  const out = vec3.create() as Cartesian;
  vec3.transformQuat(out, local, origins[origin].quat);
  return out;
}

/**
 * The projection of a point, measured about `origin`'s centre.
 *
 * `local` says which chart the polar coordinates are in. In `origin`'s own chart
 * that face's projection maps them directly; otherwise they are this face's, and
 * the map is the one this chart carries — A5's reflected triangles where they
 * reach, the unfolding past them. The frame is `origin`'s either way, and it is
 * the frame alone that the single face option changes.
 */
function polarToSphericalIn(polar: Polar, mode: ProjectionMode, origin: OriginId, local: boolean): Spherical {
  const spherical = local ? projections[mode].inverse(toFace(polar), origin) : polarToSpherical(polar, mode);
  return sphericalAbout(toCartesian(spherical), origin);
}

/**
 * Which face to measure a point in, and where it sits in that face's chart.
 *
 * A5 projects every point from its own face, so a point past this face's edge
 * belongs to a neighbour. Measuring it in the neighbour's frame is what the whole
 * system actually does; measuring it in this face's frame — which is what the
 * reflected triangles give — exposes the seam but exaggerates the distortion, as
 * the chart is being used far from the centre it belongs to.
 */
export function resolveOrigin(
  polar: Polar,
  mode: ProjectionMode,
  ownFrame: boolean
): {origin: OriginId; polar: Polar; local: boolean} {
  // Everything in this face's frames, wherever the point is. The map still comes
  // from whichever face carries it; only the two frames the derivative is written
  // in stay put
  if (!ownFrame) return {origin: ORIGIN_ID, polar, local: false};
  if (isOnFace(polar)) return {origin: ORIGIN_ID, polar, local: true};

  // Past the reflected region the sphere lookup below has nothing to work with,
  // since this chart's projection saturates there
  if (needsUnfolding(polar, mode)) {
    const {origin, face} = unfold(polar);
    return {origin, polar: toPolar(face), local: true};
  }

  const spherical = projections[mode].inverse(toFace(polar), ORIGIN_ID);
  const neighbour = findNearestOrigin(spherical);
  if (neighbour.id === ORIGIN_ID) return {origin: ORIGIN_ID, polar, local: true};
  return {origin: neighbour.id, polar: toPolar(projections[mode].forward(spherical, neighbour.id)), local: true};
}

/**
 * Inverse of `polarToCartesian`: where a point on the sphere lands on the face.
 *
 * A point of a neighbouring face is read in that face's own frame and folded back
 * into this chart. Within the reflected region that agrees with the reflected
 * chart to 1e-13 degrees, and past it the reflected chart saturates and would
 * report every point as sitting on the boundary.
 */
export function cartesianToPolar(point: Cartesian, mode: ProjectionMode = DEFAULT_PROJECTION_MODE): Polar {
  if (mode !== 'gnomonic') {
    const origin = findNearestOrigin(toSpherical(point)).id;
    const folded = origin === ORIGIN_ID ? null : foldIn(point, mode, origin);
    if (folded) return folded;
  }
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

// ---------------------------------------------------------------------------
// The unfolded neighbours
// ---------------------------------------------------------------------------

/**
 * Where a neighbouring face sits once it is rotated flat about the edge it shares
 * with this one, and how to read a point of it in that face's own frame.
 *
 * A5's reflected triangles already do exactly this for the two triangles of each
 * neighbour that abut the shared edge: measured against this, the two agree to
 * 1e-13 degrees under every equal-area mode. They stop there, but the rotation
 * carries on, and with it the rest of the neighbour.
 */
interface NeighbourFrame {
  origin: OriginId;
  /** The neighbour's centre, in this face's chart */
  centre: Face;
  cos: number;
  sin: number;
  /** Which way this face lies, in the neighbour's own chart. A multiple of 36° */
  toward: Radians;
}

const neighbourFrames: NeighbourFrame[] = Array.from({length: 5}, (_, index) => {
  const centreAngle = (index * TWO_PI_OVER_5) as Radians;
  const centre = toFace([DOMAIN_CIRCUMRADIUS, centreAngle] as Polar);

  // Far enough past the edge that the lookup cannot land back on this face
  const probe = projection.inverse(toFace([1.8 * FACE_APOTHEM, centreAngle] as Polar), ORIGIN_ID);
  const origin = findNearestOrigin(probe).id;

  // The shared edge's midpoint is a vertex of the face triangle on both sides, so
  // every mode sends it to the same point of the sphere. That alone fixes the
  // unfolding, which comes out as a rotation by -36 degrees for every neighbour.
  const midpoint = toFace([FACE_APOTHEM, centreAngle] as Polar);
  const image = projection.forward(projection.inverse(midpoint, ORIGIN_ID), origin);
  const toward = Math.atan2(image[1], image[0]) as Radians;
  const angle = toward - (centreAngle + Math.PI);
  return {origin, centre, cos: Math.cos(angle), sin: Math.sin(angle), toward};
});

/** Which neighbour's unfolded face a point past this one's edge belongs to */
function neighbourOf(gamma: Radians): NeighbourFrame {
  const index = Math.round(gamma / TWO_PI_OVER_5) % 5;
  return neighbourFrames[index < 0 ? index + 5 : index];
}

/** A point past the face edge, in the frame of the face it actually belongs to */
export function unfold(polar: Polar): {origin: OriginId; face: Face} {
  const {origin, centre, cos, sin} = neighbourOf(polar[1]);
  const point = toFace(polar);
  const x = point[0] - centre[0];
  const y = point[1] - centre[1];
  return {origin, face: [cos * x - sin * y, sin * x + cos * y] as Face};
}

/** The reverse of `unfold`: a point of a neighbour's own chart, placed in this one */
function foldPolar(polar: Polar, frame: NeighbourFrame): Polar {
  const [x, y] = toFace(polar);
  return toPolar([
    frame.centre[0] + frame.cos * x + frame.sin * y,
    frame.centre[1] - frame.sin * x + frame.cos * y
  ] as Face);
}

/** A point of a neighbouring face, folded back into this face's chart */
function foldIn(point: Cartesian, mode: ProjectionMode, origin: OriginId): Polar | null {
  const frame = neighbourFrames.find(candidate => candidate.origin === origin);
  if (!frame) return null;
  return foldPolar(toPolar(projections[mode].forwardCartesian(point, origin)), frame);
}

/**
 * How much of a neighbour's own chart is drawn: the one quintant that abuts the
 * shared edge, or two of them once the vertices are closed.
 */
function inNeighbourSector(gamma: Radians, frame: NeighbourFrame, closed: boolean): boolean {
  return Math.abs(wrapAngle(gamma - frame.toward)) <= (closed ? 2 : 1) * PI_OVER_5 + 1e-9;
}

/**
 * Whether a point has to be read in its own face's frame rather than this one's.
 *
 * The equal-area charts are assembled one triangle at a time and saturate past the
 * last of them: every point beyond the reflected region comes back pinned to its
 * boundary. The gnomonic chart is a single central projection and covers the whole
 * plane, and continuing it is the honest picture there in any case, since its
 * faces do not agree with each other to begin with.
 */
function needsUnfolding(polar: Polar, mode: ProjectionMode): boolean {
  return mode !== 'gnomonic' && !isInDomain(polar);
}

/**
 * The domain with the dodecahedron vertices closed: each neighbour contributing
 * four of its ten triangles rather than the two that abut the shared edge.
 *
 * Around a corner of this face that leaves 108 degrees from this face and 108 from
 * each of the two neighbours meeting there, which is all 324 the solid has. The
 * 36 left over is the vertex's angular defect, and it is why the outline notches
 * inward at every corner rather than closing into a decagon.
 */
function beyondMidpoint(index: number, side: 1 | -1): Face {
  const centreAngle = index * TWO_PI_OVER_5;
  const centre = toFace([DOMAIN_CIRCUMRADIUS, centreAngle as Radians] as Polar);
  const angle = centreAngle + side * 3 * PI_OVER_5;
  return [centre[0] + FACE_APOTHEM * Math.cos(angle), centre[1] + FACE_APOTHEM * Math.sin(angle)] as Face;
}

/** Distance to the edge of the closed domain, in the direction `gamma` */
export function closedDomainRadius(gamma: Radians): number {
  const beta = Math.abs(projection.normalizeGamma(gamma));
  // The neighbour's two outer edges, each as a line: r = distance / cos(beta - normal)
  const outer = (DOMAIN_CIRCUMRADIUS * Math.cos(PI_OVER_5 / 2)) / Math.cos(beta - PI_OVER_5 / 2);
  const across = (FACE_CIRCUMRADIUS * Math.cos(2 * PI_OVER_5)) / Math.cos(beta - 3 * PI_OVER_5);
  // The second only bites once the ray is pointing at it
  return across > 0 ? Math.min(outer, across) : outer;
}

/** The outer edge of whichever of the two domains is on show */
export function outerRadius(closed: boolean): (gamma: Radians) => number {
  return closed ? closedDomainRadius : domainRadius;
}

export function isInDrawnDomain([rho, gamma]: Polar, closed: boolean): boolean {
  return rho <= (closed ? closedDomainRadius(gamma) : domainRadius(gamma));
}

/** A point pulled back inside the domain, for when the domain shrinks out from under it */
export function clampToDomain(polar: Polar, closed: boolean): Polar {
  const radius = outerRadius(closed)(polar[1]);
  return polar[0] <= radius ? polar : ([radius * (1 - 1e-6), polar[1]] as Polar);
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
  /** Where the point sat in the frame it was measured in, for the metric rescaling */
  localRho: number;
  localPhi: Radians;
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

export function computeJacobian(
  point: Polar,
  mode: ProjectionMode = DEFAULT_PROJECTION_MODE,
  ownFrame = false
): Jacobian {
  const {origin, polar, local} = resolveOrigin(point, mode, ownFrame);
  const [rho, gamma] = polar;
  const r0 = Math.max(rho, MIN_RHO);
  const h = Math.min(STEP, 0.5 * r0);

  // Step the stencil off the two places the derivative jumps, so that it reports
  // the one-sided derivative on the point's own side rather than averaging both.
  // Straddling a jump is not a small error: at the face edge it puts a spurious
  // rotation of over a degree into an interior where there is none at all. The
  // shift is a few multiples of STEP, far below the precision displayed.
  const g = stepClearOfCusp(gamma, 2 * h);
  const r = stepClearOfEdge(r0, g, 3 * h);

  const [thetaRhoPlus, phiRhoPlus] = polarToSphericalIn([r + h, g] as Polar, mode, origin, local);
  const [thetaRhoMinus, phiRhoMinus] = polarToSphericalIn([r - h, g] as Polar, mode, origin, local);
  const [thetaGammaPlus, phiGammaPlus] = polarToSphericalIn([r, g + h] as Polar, mode, origin, local);
  const [thetaGammaMinus, phiGammaMinus] = polarToSphericalIn([r, g - h] as Polar, mode, origin, local);

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
  const [, phi] = polarToSphericalIn([r, g] as Polar, mode, origin, local);
  const areaRatio = (SPHERE_RADIUS * SPHERE_RADIUS * Math.sin(phi) * determinant) / r;

  return {dPhiDRho, dPhiDGamma, dThetaDRho, dThetaDGamma, determinant, areaRatio, localRho: r, localPhi: phi};
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
 * The twenty corners of the closed domain: the five mirrored face centres, the ten
 * far edge midpoints of the added triangles, and the five face corners, where the
 * outline notches back in by the vertex defect.
 */
export function closedDomainCorners(): Face[] {
  const corners: Face[] = [];
  for (let i = 0; i < 5; i++) {
    corners.push(toFace([DOMAIN_CIRCUMRADIUS, (i * TWO_PI_OVER_5) as Radians] as Polar));
    corners.push(beyondMidpoint(i, 1));
    corners.push(toFace([FACE_CIRCUMRADIUS, (PI_OVER_5 + i * TWO_PI_OVER_5) as Radians] as Polar));
    corners.push(beyondMidpoint(i + 1, -1));
  }
  return corners;
}

export function closedDomainBoundary(segmentsPerEdge = 24): Polar[] {
  return boundaryThrough(closedDomainCorners(), segmentsPerEdge);
}

/**
 * Radii of the polar grid rings. Those out to the face circumradius close on
 * themselves; beyond it a ring survives only inside the five reflected points.
 */
export const GRID_RINGS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1];

/** One spoke every 4.5°, so every eighth falls on a cusp and every fourth on a triangle bisector */
export const GRID_RAYS = 80;

/**
 * A constant-rho ring, split into the arcs that stay inside `limit`. A ring no
 * larger than the smallest the limit ever gets comes back whole.
 */
function ringArcs(rho: number, limit: (gamma: Radians) => number, smallest: number, segments: number): Polar[][] {
  const angle = (i: number) => ((TWO_PI * i) / segments) as Radians;

  if (rho <= smallest) {
    const ring: Polar[] = [];
    for (let i = 0; i <= segments; i++) ring.push([rho, angle(i)] as Polar);
    return [ring];
  }

  const inside: boolean[] = new Array(segments);
  for (let i = 0; i < segments; i++) inside[i] = rho <= limit(angle(i));

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

/** The same, over one sector of a chart rather than the whole of it */
function sectorRingArcs(rho: number, from: Radians, to: Radians, segments: number): Polar[][] {
  const arcs: Polar[][] = [];
  let current: Polar[] | null = null;
  for (let i = 0; i <= segments; i++) {
    const gamma = (from + ((to - from) * i) / segments) as Radians;
    if (rho > faceRadius(gamma)) {
      current = null;
      continue;
    }
    if (!current) {
      current = [];
      arcs.push(current);
    }
    current.push([rho, gamma] as Polar);
  }
  return arcs;
}

export interface GridRay {
  weight: RayWeight;
  /** Straight in the plane whichever chart it comes from, but not on the sphere */
  points: Polar[];
}

/**
 * Which side of the projection the grid is drawn from.
 *
 * `plane` takes the lines of constant rho and gamma, which are straight and
 * circular on the face and bent on the sphere. `sphere` takes the meridians and
 * parallels of constant theta and phi, which are the straight ones there and come
 * back kinked on the face. Same projection either way; the two put the distortion
 * in opposite windows.
 */
export type GridSource = 'plane' | 'sphere';
export const GRID_SOURCES: GridSource[] = ['plane', 'sphere'];

export interface Grid {
  rays: GridRay[];
  rings: Polar[][];
}

/** Parallels drawn when the grid comes from the sphere, in degrees of colatitude */
const GRID_PARALLELS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85];

/** A face reaches 37.377° from its own centre, at its corners */
const FACE_PHI_LIMIT = 40;

const MERIDIAN_STEPS = 80;
const PARALLEL_STEPS = 360;

/**
 * Samples a curve of the sphere, keeping the runs of it that are drawn, as
 * positions in this face's chart.
 */
function drawnRuns(
  sample: (t: number) => Cartesian,
  steps: number,
  mode: ProjectionMode,
  closed: boolean,
  face: OriginId | null
): Polar[][] {
  const runs: Polar[][] = [];
  let current: Polar[] | null = null;
  for (let i = 0; i <= steps; i++) {
    const point = sample(i / steps);
    // A face's own lines stop at its own edge; this face's carry on past it
    if (face !== null && findNearestOrigin(toSpherical(point)).id !== face) {
      current = null;
      continue;
    }
    const polar = cartesianToPolar(point, mode);
    if (!isInDrawnDomain(polar, closed)) {
      current = null;
      continue;
    }
    if (!current) {
      current = [];
      runs.push(current);
    }
    current.push(polar);
  }
  return runs;
}

/** Meridians and parallels, pulled back into this face's chart */
function sphereGrid(closed: boolean, ownFrame: boolean, mode: ProjectionMode): Grid {
  const faces: OriginId[] = ownFrame ? [ORIGIN_ID, ...neighbourFrames.map(frame => frame.origin)] : [ORIGIN_ID];
  const limit = ((ownFrame ? FACE_PHI_LIMIT : 95) * Math.PI) / 180;
  const rays: GridRay[] = [];
  const rings: Polar[][] = [];

  for (const face of faces) {
    const restrict = ownFrame ? face : null;
    for (let index = 0; index < GRID_RAYS; index++) {
      const theta = (TWO_PI * index) / GRID_RAYS;
      const weight = rayWeight(index);
      const runs = drawnRuns(t => cartesianAbout(theta, t * limit, face), MERIDIAN_STEPS, mode, closed, restrict);
      for (const points of runs) rays.push({weight, points});
    }
    for (const degrees of GRID_PARALLELS) {
      if (ownFrame && degrees > FACE_PHI_LIMIT) continue;
      const phi = (degrees * Math.PI) / 180;
      rings.push(...drawnRuns(t => cartesianAbout(TWO_PI * t, phi, face), PARALLEL_STEPS, mode, closed, restrict));
    }
  }
  return {rays, rings};
}

// The sphere side costs a projection per sample, so each configuration is built
// once and kept; both views ask for the same one
const gridCache = new Map<string, Grid>();

export function gridLines(closed: boolean, ownFrame: boolean, source: GridSource, mode: ProjectionMode): Grid {
  const key = `${closed}/${ownFrame}/${source}/${source === 'sphere' ? mode : 'any'}`;
  const cached = gridCache.get(key);
  if (cached) return cached;

  const grid: Grid =
    source === 'sphere'
      ? sphereGrid(closed, ownFrame, mode)
      : {rays: gridRays(closed, ownFrame), rings: gridRings(closed, ownFrame)};
  gridCache.set(key, grid);
  return grid;
}

/**
 * The rays of the polar grid.
 *
 * In the single face frame they are this face's own, running out past its edge
 * with the chart that measures there. Otherwise the grid follows the frame, as the
 * raster does: each face draws its own rays, so the five neighbours radiate from
 * their own centres rather than continuing this one's, and each set lands on its
 * own face's meridians instead of being bent across the fold.
 */
export function gridRays(closed: boolean, ownFrame: boolean, segments = 32): GridRay[] {
  const rays: GridRay[] = [];
  const add = (weight: RayWeight, gamma: Radians, limit: number, frame: NeighbourFrame | null) => {
    const points: Polar[] = [];
    for (let i = 0; i <= segments; i++) {
      const polar = [(limit * i) / segments, gamma] as Polar;
      points.push(frame ? foldPolar(polar, frame) : polar);
    }
    rays.push({weight, points});
  };

  for (let index = 0; index < GRID_RAYS; index++) {
    const gamma = ((TWO_PI * index) / GRID_RAYS) as Radians;
    const weight = rayWeight(index);
    if (!ownFrame) {
      add(weight, gamma, outerRadius(closed)(gamma), null);
      continue;
    }
    add(weight, gamma, faceRadius(gamma), null);
    for (const frame of neighbourFrames) {
      if (inNeighbourSector(gamma, frame, closed)) add(weight, gamma, faceRadius(gamma), frame);
    }
  }
  return rays;
}

/** The rings of the polar grid, following the same frame as the rays */
export function gridRings(closed: boolean, ownFrame: boolean, segments = 720): Polar[][] {
  if (!ownFrame) {
    return GRID_RINGS.flatMap(rho => ringArcs(rho, outerRadius(closed), FACE_CIRCUMRADIUS, segments));
  }

  const rings: Polar[][] = [];
  const width = ((closed ? 2 : 1) * PI_OVER_5) as Radians;
  for (const rho of GRID_RINGS) {
    // No face's own chart reaches past its corners
    if (rho > FACE_CIRCUMRADIUS) continue;
    rings.push(...ringArcs(rho, faceRadius, FACE_APOTHEM, segments));
    for (const frame of neighbourFrames) {
      const sector = Math.max(16, Math.round((segments * width) / Math.PI));
      const from = (frame.toward - width) as Radians;
      const to = (frame.toward + width) as Radians;
      for (const arc of sectorRingArcs(rho, from, to, sector)) {
        rings.push(arc.map(polar => foldPolar(polar, frame)));
      }
    }
  }
  return rings;
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
export function patchOutline(polar: Polar, size: number, closed = false, segments = 16): Polar[] {
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

  const radius = outerRadius(closed);
  const outline: Polar[] = [];
  for (let i = 0; i < 4; i++) {
    const [rhoA, gammaA] = corners[i];
    const [rhoB, gammaB] = corners[(i + 1) % 4];
    for (let s = 0; s < segments; s++) {
      const t = s / segments;
      const gammaT = (gammaA + (gammaB - gammaA) * t) as Radians;
      // Clip to the domain. Past it there is no face to project from, and the
      // patch would be collapsed onto the boundary rather than simply cut off
      const rhoT = Math.min(rhoA + (rhoB - rhoA) * t, radius(gammaT));
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

/** Subdivision of each closing triangle. Its edges are straight in the plane, not on the sphere */
const VERTEX_MESH_STEPS = 12;

/**
 * The ten triangles that close the face's dodecahedron vertices, as a mesh.
 *
 * Tessellated barycentrically rather than in polar coordinates: the band is
 * pinched to nothing at both ends of every sector, and a polar grid would spend
 * all its resolution there and none at the corners.
 */
export function vertexMesh(mode: ProjectionMode = DEFAULT_PROJECTION_MODE) {
  const triangles: [Face, Face, Face][] = [];
  for (let i = 0; i < 5; i++) {
    const centre = toFace([DOMAIN_CIRCUMRADIUS, (i * TWO_PI_OVER_5) as Radians] as Polar);
    for (const side of [1, -1] as const) {
      const corner = toFace([FACE_CIRCUMRADIUS, (i * TWO_PI_OVER_5 + side * PI_OVER_5) as Radians] as Polar);
      triangles.push([centre, corner, beyondMidpoint(i, side)]);
    }
  }

  const steps = VERTEX_MESH_STEPS;
  const perTriangle = ((steps + 1) * (steps + 2)) / 2;
  const positions = new Float32Array(triangles.length * perTriangle * 3);
  const indices = new Uint32Array(triangles.length * steps * steps * 3);
  let p = 0;
  let k = 0;

  for (let t = 0; t < triangles.length; t++) {
    const [a, b, c] = triangles[t];
    const base = t * perTriangle;

    for (let row = 0; row <= steps; row++) {
      for (let column = 0; column <= row; column++) {
        const wa = (steps - row) / steps;
        const wc = column / steps;
        const wb = 1 - wa - wc;
        const face = [a[0] * wa + b[0] * wb + c[0] * wc, a[1] * wa + b[1] * wb + c[1] * wc] as Face;
        const point = polarToCartesian(toPolar(face), mode);
        positions[p++] = point[0];
        positions[p++] = point[1];
        positions[p++] = point[2];
      }
    }

    // Row `row` holds row + 1 points, so it spans row upward triangles and
    // row - 1 downward ones
    for (let row = 1; row <= steps; row++) {
      const above = base + ((row - 1) * row) / 2;
      const here = base + (row * (row + 1)) / 2;
      for (let column = 0; column < row; column++) {
        indices[k++] = above + column;
        indices[k++] = here + column;
        indices[k++] = here + column + 1;
        if (column < row - 1) {
          indices[k++] = above + column;
          indices[k++] = here + column + 1;
          indices[k++] = above + column + 1;
        }
      }
    }
  }

  return {positions, indices};
}

export interface FrameJacobian {
  /** Row 0 is the radial output direction and row 1 the azimuthal; columns likewise for the input */
  rows: [[number, number], [number, number]];
  determinant: number;
  /** Ratio of the surface area elements. Exactly 1 for an equal-area projection */
  areaRatio: number;
}

/**
 * The derivative in the local orthonormal frames — (drho, rho·dgamma) on the plane
 * and (R·dphi, R·sinphi·dtheta) on the sphere — so both sides measure length.
 *
 * The raw coordinate derivative is not offered. Its singular values depend on the
 * charts rather than the projection, and its determinant varies across the face
 * even though the map is exactly equal-area, which invites precisely the wrong
 * conclusion. Here the determinant is 1 by construction, so everything that does
 * vary is shape.
 */
export function toFrame(jacobian: Jacobian): FrameJacobian {
  // Scale each row by the length its coordinate measures on the sphere, and each
  // column by the length its coordinate measures on the plane
  const rho = Math.max(jacobian.localRho, 1e-9);
  const radial = SPHERE_RADIUS;
  const azimuthal = SPHERE_RADIUS * Math.sin(jacobian.localPhi);
  const rows: [[number, number], [number, number]] = [
    [radial * jacobian.dPhiDRho, (radial * jacobian.dPhiDGamma) / rho],
    [azimuthal * jacobian.dThetaDRho, (azimuthal * jacobian.dThetaDGamma) / rho]
  ];
  const determinant = rows[0][0] * rows[1][1] - rows[0][1] * rows[1][0];
  // In these frames the determinant already is the ratio of the area elements
  return {rows, determinant, areaRatio: determinant};
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

export type DeformationChannel = 'rotation' | 'shear' | 'squash' | 'scale';

/**
 * The quantities the raster can show, one at a time.
 *
 * `scale` is flat for any of the Snyder modes in the intrinsic frame — that is
 * what equal-area means — and the raster says so rather than amplifying its
 * noise. It is worth having for the gnomonic baseline, where it is the whole
 * story.
 */
export const DEFORMATION_CHANNELS: DeformationChannel[] = ['rotation', 'shear', 'squash', 'scale'];

export interface DeformationField {
  size: number;
  /** Magnitude per pixel, row-major over the domain's bounding box with row 0 at maximum y */
  values: Record<DeformationChannel, Float32Array>;
  /**
   * Range of each quantity used to normalise it for display, low and high taken
   * separately. Robust rather than exact: see `robustRange`.
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
    // Both are ratios about one, so the signed deviation is what the ramp needs
    squash: decomposition.squash - 1,
    scale: decomposition.scale - 1
  };
}

/** Fraction trimmed from each end before taking a channel's display range */
const RANGE_TRIM = 0.01;

/** A channel whose spread is this small relative to its size carries no signal */
const CONSTANT_TOLERANCE = 1e-6;

/**
 * The true range a quantity reaches, low and high taken separately rather than
 * forced symmetric. Most of these are lopsided — the scale runs much further
 * below one than above it — and a symmetric range spends half the ramp on values
 * that never occur.
 *
 * The extreme one percent at each end is ignored. Central differences are
 * meaningless within a step of a cusp or of the face edge, and those few pixels
 * would otherwise stretch the range and flatten everything else. A quantity that
 * is constant up to that differencing error is reported as such, so its noise is
 * not amplified.
 */
function robustRange(sortedValues: Float32Array): {range: [number, number]; constant: boolean} {
  const count = sortedValues.length;
  if (count === 0) return {range: [0, 0], constant: true};

  const low = sortedValues[Math.floor(RANGE_TRIM * (count - 1))];
  const high = sortedValues[Math.ceil((1 - RANGE_TRIM) * (count - 1))];
  const span = high - low;
  const constant = span <= CONSTANT_TOLERANCE * (1 + Math.max(Math.abs(low), Math.abs(high)));
  return {range: constant ? [0, 0] : [low, high], constant};
}

export function deformationField(
  size: number,
  projectionMode: ProjectionMode = DEFAULT_PROJECTION_MODE,
  ownFrame = false,
  closed = false
): DeformationField {
  const pixels = size * size;
  const buffers = () =>
    Object.fromEntries(DEFORMATION_CHANNELS.map(channel => [channel, new Float32Array(pixels)])) as Record<
      DeformationChannel,
      Float32Array
    >;
  const values = buffers();
  const mask = new Uint8Array(pixels);

  // Masked values only, packed, for the range pass below
  const samples = buffers();
  let sampleCount = 0;

  for (let j = 0; j < size; j++) {
    const y = DOMAIN_CIRCUMRADIUS - ((j + 0.5) / size) * 2 * DOMAIN_CIRCUMRADIUS;
    for (let i = 0; i < size; i++) {
      const x = -DOMAIN_CIRCUMRADIUS + ((i + 0.5) / size) * 2 * DOMAIN_CIRCUMRADIUS;
      const polar = [Math.hypot(x, y), Math.atan2(y, x)] as Polar;
      if (!isInDrawnDomain(polar, closed)) continue;

      const index = j * size + i;
      mask[index] = 1;

      const signed = deformationValues(decompose(toFrame(computeJacobian(polar, projectionMode, ownFrame))));

      for (let c = 0; c < DEFORMATION_CHANNELS.length; c++) {
        const channel = DEFORMATION_CHANNELS[c];
        values[channel][index] = signed[channel];
        samples[channel][sampleCount] = signed[channel];
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

/**
 * The largest extent each quantity reaches across *all* the projections, so the
 * ramp can mean the same thing whichever one is selected.
 *
 * Normalising each projection over its own range is actively misleading for
 * comparison: DSEA's rotation peaks at 2.9° and ISEA's at 10.1°, but scaled
 * separately both fill the ramp and DSEA looks the worse of the two.
 *
 * Sampled coarsely — the ranges are 99th percentiles, which are stable well
 * below the raster's own resolution.
 */
export function sharedExtents(
  size = 160,
  ownFrame = false,
  closed = false
): Record<DeformationChannel, [number, number]> {
  const extents = Object.fromEntries(
    DEFORMATION_CHANNELS.map(channel => [channel, [Infinity, -Infinity] as [number, number]])
  ) as Record<DeformationChannel, [number, number]>;

  for (const projection of PROJECTION_MODES) {
    const field = deformationField(size, projection, ownFrame, closed);
    for (const channel of DEFORMATION_CHANNELS) {
      if (field.constant[channel]) continue;
      const [low, high] = field.ranges[channel];
      extents[channel][0] = Math.min(extents[channel][0], low);
      extents[channel][1] = Math.max(extents[channel][1], high);
    }
  }

  // A quantity constant in every projection has no range at all
  for (const channel of DEFORMATION_CHANNELS) {
    if (!Number.isFinite(extents[channel][0])) extents[channel] = [0, 0];
  }
  return extents;
}

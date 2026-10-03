// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import * as quat from '../math/quat';
import type {Quat} from '../math/types';
import type {Radians, Spherical} from './coordinate-systems';
import {interhedralAngle, PI_OVER_5, TWO_PI_OVER_5} from './constants';
import type {Orientation} from '../lattice';
import type {Origin, OriginId} from './utils';
import {quaternions} from './dodecahedron-quaternions';

// Quintant layouts. Every face threads its quintants with one of two patterns,
// entering at the vertex shared by its first two quintants and passing through
// the face center twice. In orientation terms u is the quintant's apex (the
// face center), v and w its outer vertices, so 'vu' runs from v to the apex.
// - jump: exits two vertices against the winding from where it entered
// - step: exits one vertex against the winding
// Clockwise faces use the mirror image (v <-> w) of the counterclockwise
// pattern. Every counterclockwise face is threaded with the jump, so the step
// only occurs clockwise: three layouts in all.
export const counterJump = ['vu', 'uv', 'wv', 'wu', 'uw'] as Orientation[];
export const clockwiseJump = ['wu', 'uw', 'vw', 'vu', 'uv'] as Orientation[];
export const clockwiseStep = ['wu', 'uw', 'vw', 'vu', 'uw'] as Orientation[];

const QUINTANT_ORIENTATIONS: Orientation[][] = [
  clockwiseStep, // 0 Arctic
  counterJump, // 1 North America
  counterJump, // 2 South America

  clockwiseStep, // 3 North Atlantic & Western Europe & Africa
  counterJump, // 4 South Atlantic & Africa
  counterJump, // 5 Europe, Middle East & CentralAfrica

  counterJump, // 6 Indian Ocean
  clockwiseJump, // 7 Asia
  clockwiseStep, // 8 Australia

  clockwiseJump, // 9 North Pacific
  counterJump, // 10 South Pacific
  counterJump // 11 Antarctic
];

// Within each face, these are the indices of the first quintant
const QUINTANT_FIRST = [4, 2, 2, 2, 0, 4, 3, 2, 1, 0, 3, 0];

// Placements of dodecahedron faces along the Hilbert curve
const ORIGIN_ORDER = [0, 1, 2, 4, 3, 5, 7, 8, 6, 11, 10, 9];

const origins: Origin[] = [];
function generateOrigins(): void {
  // North pole
  addOrigin([0, 0] as Spherical, 0 as Radians, quaternions[0]);

  // Middle band
  for (let i = 0; i < 5; i++) {
    const alpha = (i * TWO_PI_OVER_5) as Radians;
    const alpha2 = (alpha + PI_OVER_5) as Radians;
    addOrigin([alpha, interhedralAngle] as Spherical, PI_OVER_5, quaternions[i + 1]);
    addOrigin([alpha2, Math.PI - interhedralAngle] as Spherical, PI_OVER_5, quaternions[((i + 3) % 5) + 6]);
  }

  // South pole
  addOrigin([0, Math.PI] as Spherical, 0 as Radians, quaternions[11]);
}

let originId: OriginId = 0;
function addOrigin(axis: Spherical, angle: Radians, quaternion: Quat) {
  if (originId > 11) {
    throw new Error(`Too many origins: ${originId}`);
  }
  const inverseQuat = quat.create() as Quat;
  quat.conjugate(inverseQuat, quaternion); // quaternion is a unit quaternion, so conjugate is the inverse
  const origin: Origin = {
    id: originId,
    axis,
    quat: quaternion,
    inverseQuat,
    angle,
    orientation: QUINTANT_ORIENTATIONS[originId],
    firstQuintant: QUINTANT_FIRST[originId]
  };
  origins.push(origin);
  originId++;
}
generateOrigins();

// Reorder origins to match the order of the hilbert curve
origins.sort((a, b) => ORIGIN_ORDER.indexOf(a.id) - ORIGIN_ORDER.indexOf(b.id));
origins.forEach((origin, i) => (origin.id = i as OriginId));

export {origins};

/** Direction of travel around a face: 1 for counterclockwise faces, -1 for clockwise */
export function faceStep(origin: Origin): number {
  const layout = origin.orientation;
  return layout === clockwiseJump || layout === clockwiseStep ? -1 : 1;
}

export function quintantToSegment(quintant: number, origin: Origin): {segment: number; orientation: Orientation} {
  // Lookup winding direction of this face
  const layout = origin.orientation;
  const step = faceStep(origin);

  // Find (CCW) delta from first quintant of this face
  const delta = (quintant - origin.firstQuintant + 5) % 5;

  // To look up the orientation, we need to use clockwise/counterclockwise counting
  const faceRelativeQuintant = (step * delta + 5) % 5;
  const orientation = layout[faceRelativeQuintant];
  const segment = (origin.firstQuintant + faceRelativeQuintant) % 5;

  return {segment, orientation};
}

export function segmentToQuintant(segment: number, origin: Origin): {quintant: number; orientation: Orientation} {
  // Lookup winding direction of this face
  const layout = origin.orientation;
  const step = faceStep(origin);

  const faceRelativeQuintant = (segment - origin.firstQuintant + 5) % 5;
  const orientation = layout[faceRelativeQuintant];
  const quintant = (origin.firstQuintant + step * faceRelativeQuintant + 5) % 5;

  return {quintant, orientation};
}

/**
 * The `count` origins nearest to a point, by haversine distance, nearest first.
 * Used by the boundary resolution in sphericalToCell: a point on (or within
 * float noise of) a face seam or dodecahedron vertex may belong to a cell of
 * the 2nd- or 3rd-nearest face.
 */
export function findNearestOrigins(point: Spherical, count: number): Origin[] {
  const sorted = [...origins].sort((a, b) => haversine(point, a.axis) - haversine(point, b.axis));
  return sorted.slice(0, count);
}

/**
 * Find the nearest origin to a point on the sphere
 * Uses haversine formula to calculate great-circle distance
 */
export function findNearestOrigin(point: Spherical): Origin {
  let minDistance = Infinity;
  let nearest = origins[0];
  for (const origin of origins) {
    const distance = haversine(point, origin.axis);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = origin;
    }
  }

  return nearest;
}

export function isNearestOrigin(point: Spherical, origin: Origin): boolean {
  return haversine(point, origin.axis) > 0.49999999;
}

/**
 * Modified haversine formula to calculate great-circle distance.
 * Retruns the "angle" between the two points. We need to minimize this to find the nearest origin
 * TODO figure out derivation!
 * @param point The point to calculate distance from
 * @param axis The axis to calculate distance to
 * @returns The "angle" between the two points
 */
export function haversine(point: Spherical, axis: Spherical): number {
  const [theta, phi] = point;
  const [theta2, phi2] = axis;
  const dtheta = (theta2 - theta) as Radians;
  const dphi = (phi2 - phi) as Radians;
  const A1 = Math.sin(dphi / 2);
  const A2 = Math.sin(dtheta / 2);
  const angle = A1 * A1 + A2 * A2 * Math.sin(phi) * Math.sin(phi2);
  return angle;
}

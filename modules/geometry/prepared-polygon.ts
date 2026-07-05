// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// Spherical polygon (with holes) prepared for repeated point-containment
// tests: bounding-cap prefilter, then a trig-free crossing-number test with
// the winding-number test as a robust fallback.

import {vec3, glMatrix} from 'gl-matrix';
glMatrix.setMatrixArrayType(Float64Array as any);
import type {Cartesian} from '../core/coordinate-systems';
import {pointInSphericalPolygon, ringSegmentNormals} from './spherical-polygon';

const Z_AXIS = vec3.fromValues(0, 0, 1) as Cartesian;
const X_AXIS = vec3.fromValues(1, 0, 0) as Cartesian;

// Pre-allocated scratch vectors
const perp = vec3.create() as Cartesian; // unit vector perpendicular to the cap center
const arcNormal = vec3.create() as Cartesian; // normal of the probe->ref arc plane

/**
 * Point-in-polygon for a polygon with holes: inside the outer ring and
 * outside every hole ring. Winding-number test — robust but O(atan2) per
 * edge; used as the fallback for the crossing-number fast path below.
 */
function pointInPolygonRings(point: Cartesian, ringVecsList: Cartesian[][]): boolean {
  if (!pointInSphericalPolygon(point, ringVecsList[0])) return false;
  for (let r = 1; r < ringVecsList.length; r++) {
    if (pointInSphericalPolygon(point, ringVecsList[r])) return false;
  }
  return true;
}

/**
 * Bounding cap of the polygon: every polygon point is within the cap.
 * The winding-number PIP is blind at the polygon's ANTIPODE (the angle sum is
 * ±2π there too), so distant probes MUST be rejected by the cap first. The cap
 * angle is bounded by the farthest ring vertex plus half the longest edge (any
 * point of an edge arc is within half the edge length of an endpoint).
 */
interface BoundingCap {
  center: Cartesian;
  minDot: number;
}
function boundingCap(ringVecsList: Cartesian[][]): BoundingCap {
  const center = vec3.create() as Cartesian;
  for (const v of ringVecsList[0]) {
    vec3.add(center, center, v);
  }
  const len = vec3.length(center);
  if (len < 1e-12) return {center: vec3.clone(Z_AXIS) as Cartesian, minDot: -1};
  vec3.scale(center, center, 1 / len);

  let maxAngle = 0;
  let maxEdge = 0;
  for (const ringVecs of ringVecsList) {
    for (let i = 0; i < ringVecs.length; i++) {
      const v = ringVecs[i];
      const w = ringVecs[(i + 1) % ringVecs.length];
      const dotCV = vec3.dot(center, v);
      maxAngle = Math.max(maxAngle, Math.acos(Math.min(1, Math.max(-1, dotCV))));
      const dotVW = vec3.dot(v, w);
      maxEdge = Math.max(maxEdge, Math.acos(Math.min(1, Math.max(-1, dotVW))));
    }
  }
  const capAngle = Math.min(Math.PI, maxAngle + maxEdge / 2);
  return {center, minDot: Math.cos(capAngle)};
}

/**
 * Polygon prepared for repeated containment tests: rings, per-edge great-circle
 * normals, bounding cap, and a reference point for the crossing-number test.
 *
 * The reference point sits just OUTSIDE the cap (angle capAngle + 0.2 from its
 * center) rather than at the antipode: probes come from inside the cap, so
 * the probe->ref arc plane stays well conditioned (|p × ref| >= sin 0.2). The
 * fast path is disabled for very large polygons (cap over ~79°), where that
 * construction can't keep the arc short — those fall back to the winding test.
 */
export interface PreparedPolygon {
  ringVecsList: Cartesian[][];
  ringNormals: Cartesian[][];
  cap: BoundingCap;
  ref: Cartesian;
  useFast: boolean;
}
export function preparePolygon(ringVecsList: Cartesian[][]): PreparedPolygon {
  const cap = boundingCap(ringVecsList);
  const ringNormals = ringVecsList.map(ringSegmentNormals);
  const capAngle = Math.acos(Math.min(1, Math.max(-1, cap.minDot)));
  const useFast = cap.minDot > -1 && capAngle < 1.37;
  const c = cap.center;
  // unit vector perpendicular to the cap center
  vec3.cross(perp, c, Math.abs(c[2]) < 0.9 ? Z_AXIS : X_AXIS);
  const dLen = vec3.length(perp) || 1;
  const theta = capAngle + 0.2;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta) / dLen;
  const ref = vec3.create() as Cartesian;
  vec3.scale(ref, c, cosT);
  vec3.scaleAndAdd(ref, ref, perp, sinT);
  return {ringVecsList, ringNormals, cap, ref, useFast};
}

const CROSSING_EPS = 1e-14;

/**
 * Crossing-number containment: count proper crossings of the arc probe->ref
 * with every ring edge (just sign tests — no trig); odd parity = inside
 * (`ref` is outside the polygon, and the even-odd rule handles holes for
 * free). Returns undefined on any near-degenerate sign (probe or a vertex on
 * an arc plane) — the caller falls back to the winding test, which also keeps
 * on-edge tie-breaking identical to the previous implementation.
 */
function crossingParity(p: Cartesian, prep: PreparedPolygon): boolean | undefined {
  const r = prep.ref;
  vec3.cross(arcNormal, p, r);
  let crossings = 0;
  for (let ri = 0; ri < prep.ringVecsList.length; ri++) {
    const verts = prep.ringVecsList[ri];
    const norms = prep.ringNormals[ri];
    const n = verts.length;
    const sFirst = vec3.dot(arcNormal, verts[0]);
    if (Math.abs(sFirst) < CROSSING_EPS) return undefined;
    let sPrev = sFirst;
    for (let i = 0; i < n; i++) {
      let sNext: number;
      if (i + 1 === n) {
        sNext = sFirst;
      } else {
        sNext = vec3.dot(arcNormal, verts[i + 1]);
        if (Math.abs(sNext) < CROSSING_EPS) return undefined;
      }
      if (sPrev * sNext < 0) {
        // edge endpoints straddle the probe arc's plane: test whether the
        // probe arc straddles the edge's plane on the matching side
        const cd = norms[i];
        const cbd = -vec3.dot(cd, r);
        const dac = vec3.dot(cd, p);
        if (Math.abs(cbd) < CROSSING_EPS || Math.abs(dac) < CROSSING_EPS) return undefined;
        const acb = -sPrev;
        if (acb * cbd > 0 && acb * dac > 0) crossings++;
      }
      sPrev = sNext;
    }
  }
  return (crossings & 1) === 1;
}

/** Full containment test of a point: cap prefilter, then crossing test with winding fallback. */
export function pointInPreparedPolygon(p: Cartesian, prep: PreparedPolygon): boolean {
  const cap = prep.cap;
  if (vec3.dot(p, cap.center) < cap.minDot) return false;
  if (prep.useFast) {
    const result = crossingParity(p, prep);
    if (result !== undefined) return result;
  }
  return pointInPolygonRings(p, prep.ringVecsList);
}

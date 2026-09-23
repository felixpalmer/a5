// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

/**
 * The parallel small circle projection of van Leeuwen & Strebe (2006), "A
 * Slice-and-Dice Approach to Area Equivalence in Polyhedral Map Projections",
 * Cartography and Geographic Information Science 33(4), 269-286.
 *
 * Their slice-and-dice recipe maps a spherical triangle onto a plane one in two
 * steps. **Slice**: sweep a one-parameter family of curves across the spherical
 * triangle and a matching family of lines across the plane one, pairing the two
 * so that each cuts off the same fraction of its triangle's area. **Dice**: slide
 * the point along its line so that it cuts its own slice in the same ratio. Any
 * family of curves gives an equal-area projection; which one you pick is the
 * whole design space.
 *
 * A5's own projection is the other family the paper works out, the vertex
 * oriented great circle one, where the curves are great circles radiating from a
 * chosen vertex. Here the curves are small circles **parallel to a chosen side**
 * instead, shrinking to a point at the opposite vertex. The paper derives it for
 * the case where the side is a leg of the right triangle, in closed form; this is
 * the same construction written so that the third side works too.
 *
 * The slice step is inverted numerically. The paper gives a forward procedure only
 * — for both of its families — and no closed form for this one is known, so the
 * inverse costs a bracketed Newton solve of about four evaluations per point. That
 * is why A5 does not use this family: see ISEA_v_DSEA.md, which measures it as the
 * lower-distortion choice and rules it out on the inverse alone.
 */

import * as vec3 from 'a5/math/vec3';
import {barycentricToFace, faceToBarycentric} from 'a5/core/coordinate-transforms';
import {sphericalTriangleArea} from 'a5/geometry/spherical-polygon';
import type {Barycentric, Cartesian, Face, FaceTriangle, SphericalTriangle} from 'a5/core/coordinate-systems';

/**
 * The triangle in the frame the cuts are level in: the great circle through the
 * two base vertices is the equator, and the apex the family shrinks to sits at
 * latitude `apexLatitude`.
 */
interface CutFrame {
  /** Pole of the great circle the cuts are parallel to, on the apex's side */
  pole: Cartesian;
  /** Longitude is measured from here, the first base vertex */
  east: Cartesian;
  north: Cartesian;
  apex: Cartesian;
  base: [Cartesian, Cartesian];
  /** Arc length from each base vertex to the apex, and its sine */
  omega: [number, number];
  sinOmega: [number, number];
  apexLatitude: number;
  sinApexLatitude: number;
  apexAngle: number;
  area: number;
}

/** Unit vector along the component of `point` perpendicular to `at`: the arc's tangent */
function tangent(out: Cartesian, at: Cartesian, point: Cartesian): Cartesian {
  vec3.scale(out, at, -vec3.dot(point, at));
  vec3.add(out, out, point);
  return vec3.normalize(out, out) as Cartesian;
}

/** The angle a great circle arc leaves `at` on, against a reference direction */
function angleBetween(a: Cartesian, b: Cartesian): number {
  return Math.acos(Math.max(-1, Math.min(1, vec3.dot(a, b))));
}

/**
 * The frame for one triangle, apex first. `[apex, base0, base1]` matches the
 * `[radiating vertex, ...]` ordering the great circle family uses, so the two
 * families can share the face triangles unchanged.
 */
function buildCutFrame([apex, base0, base1]: SphericalTriangle): CutFrame {
  const pole = vec3.create() as Cartesian;
  vec3.cross(pole, base0, base1);
  vec3.normalize(pole, pole);
  // The apex is what the cuts shrink towards, so it is the positive side
  if (vec3.dot(pole, apex) < 0) vec3.scale(pole, pole, -1);

  const north = vec3.create() as Cartesian;
  vec3.cross(north, pole, base0);
  vec3.normalize(north, north);

  const toBase0 = tangent(vec3.create() as Cartesian, apex, base0);
  const toBase1 = tangent(vec3.create() as Cartesian, apex, base1);

  const omega: [number, number] = [angleBetween(base0, apex), angleBetween(base1, apex)];
  const apexLatitude = Math.asin(Math.max(-1, Math.min(1, vec3.dot(pole, apex))));

  return {
    pole,
    east: base0,
    north,
    apex,
    base: [base0, base1],
    omega,
    sinOmega: [Math.sin(omega[0]), Math.sin(omega[1])],
    apexLatitude,
    sinApexLatitude: Math.sin(apexLatitude),
    apexAngle: angleBetween(toBase0, toBase1),
    // Unsigned: the caller owns the winding, this only needs the size
    area: Math.abs(sphericalTriangleArea(apex, base0, base1))
  };
}

/**
 * One frame per triangle, kept by identity.
 *
 * The caller hands back the same frozen triangles over and over — there are only
 * a few hundred of them across the whole solid — and rebuilding the frame on every
 * projection call was most of the cost of this projection.
 */
const frameCache = new WeakMap<SphericalTriangle, CutFrame>();

function cutFrame(sphericalTriangle: SphericalTriangle): CutFrame {
  const cached = frameCache.get(sphericalTriangle);
  if (cached) return cached;
  const frame = buildCutFrame(sphericalTriangle);
  frameCache.set(sphericalTriangle, frame);
  return frame;
}

/** Longitude about the pole, measured from the first base vertex */
function longitude(frame: CutFrame, point: Cartesian): number {
  return Math.atan2(vec3.dot(point, frame.north), vec3.dot(point, frame.east));
}

/**
 * Where the cut at latitude `t` crosses the side from a base vertex to the apex.
 *
 * Along that arc the latitude is sin(sigma * omega) * sin(apexLatitude) / sin(omega),
 * since the base vertex is on the equator, so the crossing has a closed form. The
 * arc is shorter than a quarter turn for every triangle of the dodecahedron, so
 * the latitude rises monotonically along it and the principal arcsine is the one.
 */
function crossing(out: Cartesian, frame: CutFrame, side: 0 | 1, sinT: number): Cartesian {
  const omega = frame.omega[side];
  const sinOmega = frame.sinOmega[side];
  const ratio = (sinT * sinOmega) / frame.sinApexLatitude;
  const sigma = Math.asin(Math.max(-1, Math.min(1, ratio)));
  vec3.scale(out, frame.base[side], Math.sin(omega - sigma) / sinOmega);
  vec3.scaleAndAdd(out, out, frame.apex, Math.sin(sigma) / sinOmega);
  return vec3.normalize(out, out) as Cartesian;
}

/** One cut: where it crosses the two sides, and how much of the triangle it leaves above */
interface Cut {
  longitudes: [number, number];
  /** Area of the piece between the cut and the apex */
  area: number;
  /** Arc length of the cut inside the triangle, which is -d(area)/d(t) */
  length: number;
}

const _crossing0 = vec3.create() as Cartesian;
const _crossing1 = vec3.create() as Cartesian;
const _alongCut = vec3.create() as Cartesian;
const _towardApex = vec3.create() as Cartesian;

/**
 * The cut at latitude `t`, by Gauss-Bonnet on the piece above it.
 *
 * That piece is bounded by two great circle arcs and one small circle, so its
 * area is the angle sum less pi, less the small circle's geodesic curvature
 * integrated along it. A circle at latitude t has curvature tan(t) and length
 * cos(t) per radian of longitude, so that last term is just sin(t) times the
 * longitude it spans — the `d sin b` of the paper's equation (8).
 */
function cutAt(frame: CutFrame, t: number): Cut {
  const sinT = Math.sin(t);
  const f0 = crossing(_crossing0, frame, 0, sinT);
  const f1 = crossing(_crossing1, frame, 1, sinT);
  const lambda0 = longitude(frame, f0);
  const lambda1 = longitude(frame, f1);
  const span = lambda1 - lambda0;
  const direction = span >= 0 ? 1 : -1;

  // Interior angle where the cut meets each side. The cut runs east-west, so its
  // tangent is the pole crossed into the point
  vec3.cross(_alongCut, frame.pole, f0);
  vec3.normalize(_alongCut, _alongCut);
  vec3.scale(_alongCut, _alongCut, direction);
  const angle0 = angleBetween(_alongCut, tangent(_towardApex, f0, frame.apex));

  vec3.cross(_alongCut, frame.pole, f1);
  vec3.normalize(_alongCut, _alongCut);
  vec3.scale(_alongCut, _alongCut, -direction);
  const angle1 = angleBetween(_alongCut, tangent(_towardApex, f1, frame.apex));

  const width = Math.abs(span);
  return {
    longitudes: [lambda0, lambda1],
    area: Math.max(0, angle0 + frame.apexAngle + angle1 - Math.PI - sinT * width),
    length: Math.sqrt(Math.max(0, 1 - sinT * sinT)) * width
  };
}

/** Newton, bracketed, for the cut that leaves `targetArea` above it */
function cutForArea(frame: CutFrame, targetArea: number): {t: number; cut: Cut} {
  let low = 0;
  let high = frame.apexLatitude;
  // A flat triangle would put the cut at this height; the sphere barely moves it
  let t = frame.apexLatitude * (1 - Math.sqrt(Math.max(0, targetArea / frame.area)));
  let cut = cutAt(frame, t);

  for (let i = 0; i < 24; i++) {
    const residual = cut.area - targetArea;
    if (Math.abs(residual) < 1e-15) break;
    // Area falls as the cut rises, so the residual brackets the root the other way
    if (residual > 0) low = t;
    else high = t;

    const slope = cut.length;
    const step = slope > 1e-12 ? residual / slope : 0;
    let next = t + step;
    if (!(next > low && next < high)) next = 0.5 * (low + high);
    if (Math.abs(next - t) < 1e-16) break;
    t = next;
    cut = cutAt(frame, t);
  }

  return {t, cut};
}

/**
 * Drop-in alternative to `EqualAreaProjection` whose cuts are small circles
 * parallel to the side opposite the leading vertex, rather than great circles
 * radiating from it.
 */
export class ParallelSmallCircleProjection {
  forward(V: Cartesian, sphericalTriangle: SphericalTriangle, faceTriangle: FaceTriangle): Face {
    const frame = cutFrame(sphericalTriangle);
    const t = Math.asin(Math.max(-1, Math.min(1, vec3.dot(frame.pole, V))));
    const cut = cutAt(frame, Math.max(0, Math.min(frame.apexLatitude, t)));

    // Slice: the piece above the cut is similar to the plane triangle, so the
    // fraction of the area fixes the fraction of the height
    const scale = Math.sqrt(Math.max(0, cut.area / frame.area));

    // Dice: position along the cut is linear in longitude, since a thin slice's
    // area and a thin plane trapezoid's are both proportional to their width
    const [lambda0, lambda1] = cut.longitudes;
    const span = lambda1 - lambda0;
    const along = Math.abs(span) > 1e-12 ? (longitude(frame, V) - lambda0) / span : 0;
    const u = Math.max(0, Math.min(1, along));

    const barycentric = [1 - scale, scale * (1 - u), scale * u] as Barycentric;
    return barycentricToFace(barycentric, faceTriangle);
  }

  inverse(facePoint: Face, faceTriangle: FaceTriangle, sphericalTriangle: SphericalTriangle): Cartesian {
    const frame = cutFrame(sphericalTriangle);
    const b = faceToBarycentric(facePoint, faceTriangle);

    const scale = Math.max(0, Math.min(1, 1 - b[0]));
    if (scale < 1e-15) {
      return vec3.clone(frame.apex) as Cartesian;
    }
    const u = Math.max(0, Math.min(1, b[2] / scale));

    const {t, cut} = cutForArea(frame, scale * scale * frame.area);
    const [lambda0, lambda1] = cut.longitudes;
    const lambda = lambda0 + u * (lambda1 - lambda0);

    const out = vec3.create() as Cartesian;
    vec3.scale(out, frame.east, Math.cos(t) * Math.cos(lambda));
    vec3.scaleAndAdd(out, out, frame.north, Math.cos(t) * Math.sin(lambda));
    vec3.scaleAndAdd(out, out, frame.pole, Math.sin(t));
    return vec3.normalize(out, out) as Cartesian;
  }
}

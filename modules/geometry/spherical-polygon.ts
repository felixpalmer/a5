// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {vec3, glMatrix} from 'gl-matrix';
glMatrix.setMatrixArrayType(Float64Array as any);
import type {Cartesian, Radians} from '../core/coordinate-systems';
import {slerp, tripleProduct} from '../utils/vector';

const _windingCentroid = vec3.create() as Cartesian;
const center = vec3.create() as Cartesian;

// Use Cartesian system for all calculations for greater accuracy
// Using [x, y, z] gives equal precision in all directions, unlike spherical coordinates
export type SphericalPolygon = Cartesian[];

/**
 * Signed area (spherical excess) of the spherical triangle (v1, v2, v3) on the
 * unit sphere, in radians.
 *
 * Uses the Van Oosterom–Strackee formula
 * atan2 keeps full precision for tiny triangles (numerator → area/2) and
 * does not fold areas above π back into [-π, π].
 * Free-function form avoids the class/array allocations of
 * `new SphericalTriangleShape([…])` on the lonLatToCell / cellToLonLat hot path.
 */
export function sphericalTriangleArea(v1: Cartesian, v2: Cartesian, v3: Cartesian): Radians {
  const norm =
    1 +
    (v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]) +
    (v2[0] * v3[0] + v2[1] * v3[1] + v2[2] * v3[2]) +
    (v3[0] * v1[0] + v3[1] * v1[1] + v3[2] * v1[2]);
  return (2 * Math.atan2(tripleProduct(v1, v2, v3), norm)) as Radians;
}

/**
 * Spherical point-in-polygon via signed-angle summation. Works for concave
 * polygons (unlike `SphericalPolygonShape.containsPoint`, which assumes convex
 * "necessary strike"). The math is fully inlined as it's called per-cell in
 * polygon-fill hot paths.
 */
export function pointInSphericalPolygon(point: Cartesian, vertices: Cartesian[]): boolean {
  let angleSum = 0;
  for (let i = 0; i < vertices.length; i++) {
    const av = vertices[i];
    const bv = vertices[(i + 1) % vertices.length];
    const dotPA = point[0] * av[0] + point[1] * av[1] + point[2] * av[2];
    const dotPB = point[0] * bv[0] + point[1] * bv[1] + point[2] * bv[2];
    const apx = av[0] - dotPA * point[0],
      apy = av[1] - dotPA * point[1],
      apz = av[2] - dotPA * point[2];
    const bpx = bv[0] - dotPB * point[0],
      bpy = bv[1] - dotPB * point[1],
      bpz = bv[2] - dotPB * point[2];
    const cx = apy * bpz - apz * bpy;
    const cy = apz * bpx - apx * bpz;
    const cz = apx * bpy - apy * bpx;
    angleSum += Math.atan2(cx * point[0] + cy * point[1] + cz * point[2], apx * bpx + apy * bpy + apz * bpz);
  }
  return Math.abs(angleSum) > Math.PI;
}

/**
 * Ring winding direction: +1 for CCW (interior to the left of edge direction), -1 for CW.
 * Sums (v_i × v_{i+1}) · centroid across the ring.
 */
export function ringWindingSign(ringVecs: Cartesian[]): 1 | -1 {
  vec3.set(_windingCentroid, 0, 0, 0);
  for (const v of ringVecs) vec3.add(_windingCentroid, _windingCentroid, v);
  vec3.normalize(_windingCentroid, _windingCentroid);

  let sum = 0;
  for (let i = 0; i < ringVecs.length; i++) {
    sum += tripleProduct(_windingCentroid, ringVecs[i], ringVecs[(i + 1) % ringVecs.length]);
  }
  return sum > 0 ? 1 : -1;
}

/** Great-circle plane normals for every segment of the ring. */
export function ringSegmentNormals(ringVecs: Cartesian[]): Cartesian[] {
  const normals: Cartesian[] = new Array(ringVecs.length);
  for (let i = 0; i < ringVecs.length; i++) {
    const n = vec3.create() as Cartesian;
    vec3.cross(n, ringVecs[i], ringVecs[(i + 1) % ringVecs.length]);
    normals[i] = n;
  }
  return normals;
}

export class SphericalPolygonShape {
  protected vertices: SphericalPolygon;
  private _area: Radians | null = null;

  constructor(vertices: SphericalPolygon) {
    this.vertices = vertices;
    // this.isWindingCorrect();
    Object.freeze(this.vertices);
  }

  /**
   *
   * @param nSegments Returns a closed boundary of the polygon, with nSegments points per edge
   * @returns SphericalPolygon
   */
  getBoundary(nSegments: number = 1, closedRing: boolean = true): SphericalPolygon {
    const points: SphericalPolygon = [];
    const N = this.vertices.length;
    for (let s = 0; s < N * nSegments; s++) {
      const t = s / nSegments;
      points.push(this.slerp(t));
    }
    if (closedRing) {
      points.push(points[0]);
    }

    return points;
  }

  /**
   * Interpolates along boundary of polygon. Pass t = 1.5 to get the midpoint between 2nd and 3rd vertices
   * @param t
   * @returns Cartesian coordinate
   */
  slerp(t: number): Cartesian {
    const N = this.vertices.length;
    const f = t % 1;
    const i = Math.floor(t % N);
    const j = (i + 1) % N;
    return slerp(vec3.create() as Cartesian, this.vertices[i], this.vertices[j], f);
  }

  /**
   * Returns the vertex given by index t, along with the vectors:
   * - VA: Vector from vertex to point A
   * - VB: Vector from vertex to point B
   * @param t
   * @returns
   */
  getTransformedVertices(t: number): [Cartesian, Cartesian, Cartesian] {
    const N = this.vertices.length;
    const i = Math.floor(t % N);
    const j = (i + 1) % N;
    const k = (i + N - 1) % N;

    // Points A & B (vertex before and after)
    const V = vec3.clone(this.vertices[i]) as Cartesian;
    const VA = vec3.clone(this.vertices[j]) as Cartesian;
    const VB = vec3.clone(this.vertices[k]) as Cartesian;
    vec3.sub(VA, VA, V);
    vec3.sub(VB, VB, V);
    return [V, VA, VB];
  }

  containsPoint(point: Cartesian): number {
    // Adaption of algorithm from:
    // 'Locating a point on a spherical surface relative to a spherical polygon'
    // Using only the condition of 'necessary strike'
    const N = this.vertices.length;
    let thetaDeltaMin = Infinity;

    for (let i = 0; i < N; i++) {
      // Transform point and neighboring vertices into coordinate system centered on vertex
      const [V, VA, VB] = this.getTransformedVertices(i);
      const VP = vec3.sub(vec3.create(), point, V);

      // Normalize to obtain unit direction vectors
      vec3.normalize(VP, VP);
      vec3.normalize(VA, VA);
      vec3.normalize(VB, VB);

      // Cross products will point away from the center of the sphere when
      // point P is within arc formed by VA and VB
      const crossAP = vec3.cross(vec3.create(), VA, VP);
      const crossPB = vec3.cross(vec3.create(), VP, VB);

      // Dot product will be positive when point P is within arc formed by VA and VB
      // The magnitude of the dot product is the sine of the angle between the two vectors
      // which is the same as the angle for small angles.
      const sinAP = vec3.dot(V, crossAP);
      const sinPB = vec3.dot(V, crossPB);

      // By returning the minimum value we find the arc where the point is closest to being outside
      thetaDeltaMin = Math.min(thetaDeltaMin, sinAP, sinPB);
    }

    // If point is inside all arcs, will return a position value
    // If point is on edge of arc, will return 0
    // If point is outside all arcs, will return -1, the further away from 0, the further away from the arc
    return thetaDeltaMin;
  }

  /**
   * Calculate the area of the spherical polygon by decomposing it into a fan of triangles
   * @returns The area of the spherical polygon in radians
   */
  getArea(): Radians {
    // Memoize the result since vertices are immutable
    if (this._area === null) {
      this._area = this._getArea();
    }
    return this._area;
  }

  private _getArea(): Radians {
    if (this.vertices.length < 3) {
      return 0 as Radians;
    }

    if (this.vertices.length === 3) {
      this._area = sphericalTriangleArea(this.vertices[0], this.vertices[1], this.vertices[2]);
      return this._area;
    }

    // Calculate center of polygon
    vec3.set(center, 0, 0, 0);
    for (const vertex of this.vertices) {
      vec3.add(center, center, vertex);
    }
    vec3.normalize(center, center);

    // Sum fan of triangles around center
    let area = 0;
    for (let i = 0; i < this.vertices.length; i++) {
      const v1 = this.vertices[i];
      const v2 = this.vertices[(i + 1) % this.vertices.length];
      const triArea = sphericalTriangleArea(center, v1, v2);
      if (!isNaN(triArea)) {
        area += triArea;
      }
    }
    this._area = area as Radians;
    return this._area;
  }

  /**
   * For debugging purposes, check if the winding order is correct
   * In production, should always be correct
   */
  private isWindingCorrect(): void {
    const area = this.getArea();
    const isCorrect = area > 0;
    if (!isCorrect) {
      debugger;
    }
  }
}

// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {vec3, glMatrix, quat} from 'gl-matrix';
glMatrix.setMatrixArrayType(Float64Array as any);
import type { Cartesian } from './coordinate-systems';

// Use Cartesian system for all calculations for greater accuracy
// Using [x, y, z] gives equal precision in all directions, unlike spherical coordinates
export type SphericalPolygon = Cartesian[];
const UP = [0, 0, 1] as Cartesian;

export class SphericalPentagonShape {
  private vertices: SphericalPolygon;

  constructor(vertices: SphericalPolygon) {
    this.vertices = vertices;
    if (!this.isWindingCorrect()) {
      this.vertices.reverse();
    }
  }

  /**
   * 
   * @param nSegments Returns a close boundary of the polygon, with nSegments points per edge
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

    // Points A & B
    const A = this.vertices[i];
    const B = this.vertices[j];

    // Quaternions
    const identity = quat.create();
    const qOA = quat.rotationTo(quat.create(), UP, A);
    const qAB = quat.rotationTo(quat.create(), A, B);
    const qPartial = quat.slerp(quat.create(), identity, qAB, f);
    const qCombined = quat.multiply(quat.create(), qPartial, qOA);

    const out = vec3.fromValues(0, 0, 1);
    vec3.transformQuat(out, out, qCombined);
    return out as Cartesian;
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
      const crossPA = vec3.cross(vec3.create(), VP, VA);
      const crossBP = vec3.cross(vec3.create(), VB, VP);

      // Dot product will be positive when point P is within arc formed by VA and VB
      // The magnitude of the dot product is the sine of the angle between the two vectors
      // which is the same as the angle for small angles.
      const sinPA = vec3.dot(V, crossPA);
      const sinBP = vec3.dot(V, crossBP);

      // By returning the minimum value we find the arc where the point is closest to being outside
      thetaDeltaMin = Math.min(thetaDeltaMin, sinPA, sinBP);
    }

    // If point is inside all arcs, will return a position value
    // If point is on edge of arc, will return 0
    // If point is outside all arcs, will return -1, the further away from 0, the further away from the arc
    return thetaDeltaMin;
  }

  private isWindingCorrect(): boolean {
    const [V, VA, VB] = this.getTransformedVertices(0);
    const cross = vec3.cross(vec3.create(), VA, VB);
    return vec3.dot(V, cross) <= 0;
  }
}
// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {vec3, glMatrix, quat} from 'gl-matrix';
glMatrix.setMatrixArrayType(Float64Array as any);
import type { Cartesian, Radians } from './coordinate-systems';
import { slerp } from '../utils/vector';

// Pre-allocated vectors for midpoints. midA is the midpoint opposite the vertex A
const midA = vec3.create() as Cartesian;
const midB = vec3.create() as Cartesian;
const midC = vec3.create() as Cartesian;
const center = vec3.create() as Cartesian;

// Use Cartesian system for all calculations for greater accuracy
// Using [x, y, z] gives equal precision in all directions, unlike spherical coordinates
export type SphericalPolygon = Cartesian[];

export class SphericalPolygonShape {
  protected vertices: SphericalPolygon;

  constructor(vertices: SphericalPolygon) {
    this.vertices = vertices;
    if (this.vertices.length >= 3 && !this.isWindingCorrect()) {
      this.vertices.reverse();
    }
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
   * Calculate the area of a spherical triangle given three vertices
   * @param v1 First vertex
   * @param v2 Second vertex  
   * @param v3 Third vertex
   * @returns Area of the spherical triangle in radians
   */
  private getTriangleArea(v1: Cartesian, v2: Cartesian, v3: Cartesian): Radians {
    // Calculate midpoints
    vec3.lerp(midA, v2, v3, 0.5);
    vec3.lerp(midB, v3, v1, 0.5);
    vec3.lerp(midC, v1, v2, 0.5);
    vec3.normalize(midA, midA);
    vec3.normalize(midB, midB);
    vec3.normalize(midC, midC);
    
    // Compute scalar triple product of midpoints.
    const crossBC = vec3.create();
    vec3.cross(crossBC, midB, midC);
    const tripleProduct = vec3.dot(midA, crossBC);

    // Calculate area using asin of dot product, clamped to valid range
    const clamped = Math.max(-1.0, Math.min(1.0, tripleProduct));
    
    // sin(x) = x for x < 1e-8
    if (Math.abs(clamped) < 1e-8) {
      return 2 * clamped as Radians;
    } else {
      return Math.asin(clamped) * 2 as Radians;
    }
  }

  /**
   * Calculate the area of the spherical polygon by decomposing it into a fan of triangles
   * @returns The area of the spherical polygon in radians
   */
  getArea(): Radians {
    if (this.vertices.length < 3) {
      return 0 as Radians;
    }
    if (this.vertices.length === 3) {
      return this.getTriangleArea(this.vertices[0], this.vertices[1], this.vertices[2]);
    }

    vec3.set(center, 0, 0, 0);
    for (const vertex of this.vertices) {
      vec3.add(center, center, vertex);
    }

    vec3.normalize(center, center);
    console.log(center);

    let area = 0;
    for (let i = 1; i < this.vertices.length - 1; i++) {
      const v1 = this.vertices[i];
      const v2 = this.vertices[i + 1];
      const triArea = this.getTriangleArea(center, v1, v2);
      console.log(triArea);
      if (!isNaN(triArea)) {
        area += triArea;
      }
    }
    return area as Radians;
  }

  private isWindingCorrect(): boolean {
    const [V, VA, VB] = this.getTransformedVertices(0);
    const cross = vec3.cross(vec3.create(), VA, VB);
    return vec3.dot(V, cross) >= 0;
  }
}
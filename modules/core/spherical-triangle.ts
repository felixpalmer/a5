// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {vec3, glMatrix} from 'gl-matrix';
glMatrix.setMatrixArrayType(Float64Array as any);
import type { Cartesian, Radians } from './coordinate-systems';
import { SphericalPolygonShape } from './spherical-polygon';

// Pre-allocated vectors for midpoints. midA is the midpoint opposite the vertex A
const midA = vec3.create();
const midB = vec3.create();
const midC = vec3.create();

export class SphericalTriangleShape extends SphericalPolygonShape {
  private _area: Radians | null = null;

  constructor(vertices: Cartesian[]) {
    if (vertices.length !== 3) {
      throw new Error('SphericalTriangleShape requires exactly 3 vertices');
    }
    super(vertices);
  }

  /**
   * Calculates the area of this spherical triangle
   * @returns The area in radians
   */
  getArea(): Radians {
    // Memoize the result since vertices are immutable
    if (this._area !== null) {
      return this._area;
    }

    const [A, B, C] = this.vertices;
    
    // Calculate midpoints
    vec3.lerp(midA, B, C, 0.5);
    vec3.lerp(midB, C, A, 0.5);
    vec3.lerp(midC, A, B, 0.5);
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
      this._area = 2 * clamped as Radians;
    } else {
      this._area = Math.asin(clamped) * 2 as Radians;
    }
    
    return this._area;
  }
} 
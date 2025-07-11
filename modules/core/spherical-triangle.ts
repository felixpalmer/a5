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
  constructor(vertices: Cartesian[]) {
    if (vertices.length !== 3) {
      throw new Error('SphericalTriangleShape requires exactly 3 vertices');
    }
    super(vertices);
  }
} 
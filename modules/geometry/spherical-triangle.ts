// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {glMatrix} from 'gl-matrix';
glMatrix.setMatrixArrayType(Float64Array as any);
import type { Cartesian } from '../core/coordinate-systems';
import { SphericalPolygonShape } from './spherical-polygon';

export class SphericalTriangleShape extends SphericalPolygonShape {
  constructor(vertices: Cartesian[]) {
    if (vertices.length !== 3) {
      throw new Error('SphericalTriangleShape requires exactly 3 vertices');
    }
    super(vertices);
  }
} 
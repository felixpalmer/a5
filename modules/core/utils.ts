// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {glMatrix, quat} from 'gl-matrix';
glMatrix.setMatrixArrayType(Float64Array as any);
import type { Radians, Spherical } from './coordinate-systems';
import type { Orientation } from "../lattice";

export type OriginId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
export type Origin = {
  id: OriginId;
  axis: Spherical;
  quat: quat;
  inverseQuat: quat;
  angle: Radians;
  orientation: Orientation[];
  firstQuintant: number;
}; 

export type A5Cell = {
  /**
   * Origin representing one of pentagon face of the dodecahedron
   */
  origin: Origin;
  /**
   * Index (0-4) of triangular segment within pentagonal dodecahedron face
   */
  segment: number;
  /**
   * Position along Hilbert curve within triangular segment
   */
  S: bigint;
  /**
   * Resolution of the cell
   */
  resolution: number;
}
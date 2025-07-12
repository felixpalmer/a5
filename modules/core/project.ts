// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { glMatrix } from 'gl-matrix';
glMatrix.setMatrixArrayType(Float64Array as any);
import { PentagonShape } from './utils';
import { Origin } from './utils';
import { DodecahedronProjection } from '../projections/dodecahedron';
import type { Face, LonLat } from './coordinate-systems';
import { toLonLat, normalizeLongitudes } from './coordinate-transforms';

const dodecahedron = new DodecahedronProjection();

export function projectPoint(vertex: Face, origin: Origin, resolution: number): LonLat {
  const point = dodecahedron.inverse(vertex, origin.quat, origin.angle, resolution);
  return toLonLat(point);
}

export function projectPentagon(pentagon: PentagonShape, origin: Origin, resolution: number): LonLat[] {
  const vertices = pentagon.getVertices();
  const rotatedVertices = vertices.map(vertex => projectPoint(vertex, origin, resolution));

  // Normalize longitudes to handle antimeridian crossing
  const normalizedVertices = normalizeLongitudes(rotatedVertices);
  return normalizedVertices;
}
// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import * as mat2 from '../math/mat2';
import * as vec2 from '../math/vec2';
import type {Vec2} from '../math/types';
import {Pentagon, PentagonShape} from '../geometry/pentagon';
import {BASIS, PENTAGON, TRIANGLE, v} from './pentagon';
import {TWO_PI_OVER_5} from './constants';
import type {Triple} from '../lattice';
import {Polar} from './coordinate-systems';

const TRIANGLE_MODE = false;

/**
 * Define transforms for each pentagon in the primitive unit
 * Using pentagon vertices and angle as the basis for the transform
 */
const QUINTANT_ROTATIONS = [0, 1, 2, 3, 4].map(quintant => {
  const rotation = mat2.create();
  mat2.fromRotation(rotation, TWO_PI_OVER_5 * quintant);
  return rotation;
});

const translation = vec2.create();
const refIJ = vec2.create();

// Center of the base PENTAGON under each flavor's orientation ops. The vertex
// mean is linear, so an oriented pentagon's center is the transformed base
// center — no need to construct the five vertices when only the center is
// wanted (see getPentagonCenter).
const FLAVOR_CENTERS = [0, 1, 2, 3].map(flavor => {
  const p = PENTAGON.clone();
  if (flavor & 1) p.rotate180();
  if (flavor & 2) p.reflectY();
  return p.getCenter();
});

/**
 * Get pentagon vertices for a cell.
 *
 * A cell's pentagon is one of exactly FOUR orientations of the base PENTAGON
 * (the Cairo-like metatile): flavor bit 0 is a 180° rotation, bit 1 a Y
 * reflection. The oriented pentagon sits at the triple-derived lattice point
 * ref = (x+y, -x) in IJ, shifted by one j unit for the rotated flavors.
 * The flavor is a 1:1 function of the cell's L-system jigsaw piece and is
 * produced by the descent (sToCell); the placement was derived and verified
 * exhaustively against the pentagon geometry.
 *
 * @param resolution The resolution level
 * @param quintant The quintant index (0-4)
 * @param triple The cell's triple coordinates
 * @param flavor The cell's pentagon flavor (0-3)
 * @returns A pentagon shape with transformed vertices
 */
export function getPentagonVertices(
  resolution: number,
  quintant: number,
  triple: Triple,
  flavor: number,
  triangleMode: boolean = TRIANGLE_MODE
): PentagonShape {
  const pentagon = (triangleMode ? TRIANGLE : PENTAGON).clone();

  if (flavor & 1) pentagon.rotate180();
  if (flavor & 2) pentagon.reflectY();

  // Position within quintant: ref(triple), plus (0, 1) for the rotated flavors
  vec2.set(refIJ, triple.x + triple.y, -triple.x + (flavor & 1));
  vec2.transformMat2(translation, refIJ, BASIS);
  pentagon.translate(translation);
  pentagon.scale(1 / 2 ** resolution);
  pentagon.transform(QUINTANT_ROTATIONS[quintant]);

  return pentagon;
}

/**
 * The center of a cell's pentagon, without constructing the pentagon —
 * O(1) via the precomputed flavor centers. Equivalent to
 * `getPentagonVertices(...).getCenter()` (up to float associativity).
 */
export function getPentagonCenter(resolution: number, quintant: number, triple: Triple, flavor: number): Vec2 {
  const c = FLAVOR_CENTERS[flavor];
  vec2.set(refIJ, triple.x + triple.y, -triple.x + (flavor & 1));
  vec2.transformMat2(translation, refIJ, BASIS);
  const out = vec2.fromValues((c[0] + translation[0]) / 2 ** resolution, (c[1] + translation[1]) / 2 ** resolution);
  return vec2.transformMat2(out, out, QUINTANT_ROTATIONS[quintant]);
}

// TODO: memoize these two functions?
export function getQuintantVertices(quintant: number): PentagonShape {
  const triangle = TRIANGLE.clone();
  triangle.transform(QUINTANT_ROTATIONS[quintant]);
  return triangle;
}

export function getFaceVertices(): PentagonShape {
  const vertices: Vec2[] = [];
  for (const rotation of QUINTANT_ROTATIONS) {
    vertices.push(vec2.transformMat2(vec2.create(), v, rotation));
  }

  // Need to reverse to obtain correct winding order
  vertices.reverse();
  return new PentagonShape(vertices as Pentagon);
}

export function getQuintantPolar([_, gamma]: Polar): number {
  return (Math.round(gamma / TWO_PI_OVER_5) + 5) % 5;
}

// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { mat2, vec2, glMatrix } from "gl-matrix";
glMatrix.setMatrixArrayType(Float64Array as any);
import { Pentagon, PentagonShape } from "./utils";
import { a, BASIS, PENTAGON, TRIANGLE, v, V, w } from "./pentagon";
import { TWO_PI, TWO_PI_OVER_5 } from "./constants";
import { NO, Anchor, YES } from "./hilbert";
import { Polar } from "./coordinate-systems";

const TRIANGLE_MODE = false;

const shiftRight = vec2.clone(w);
const shiftLeft = vec2.negate(vec2.create(), w);

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

/**
 * Get pentagon vertices
 * @param resolution The resolution level
 * @param quintant The quintant index (0-4)
 * @param anchor The anchor information
 * @returns A pentagon shape with transformed vertices
 */
export function getPentagonVertices(resolution: number, quintant: number, anchor: Anchor): PentagonShape {
  const pentagon = (TRIANGLE_MODE ? TRIANGLE : PENTAGON).clone();
  
  vec2.transformMat2(translation, anchor.offset, BASIS);

  // Apply transformations based on anchor properties
  if (anchor.flips[0] === NO && anchor.flips[1] === YES) {
    pentagon.rotate180();
  }

  const {k} = anchor;
  const F = anchor.flips[0] + anchor.flips[1];
  if (
    // Orient last two pentagons when both or neither flips are YES
    ((F === -2 || F === 2) && k > 1) ||
    // Orient first & last pentagons when only one of flips is YES
    (F === 0 && (k === 0 || k === 3))
  ) {
    pentagon.reflectY();
  }

  if (anchor.flips[0] === YES && anchor.flips[1] === YES) {
    pentagon.rotate180();
  } else if (anchor.flips[0] === YES) {
    pentagon.translate(shiftLeft);
  } else if (anchor.flips[1] === YES) {
    pentagon.translate(shiftRight);
  }

  // Position within quintant
  pentagon.translate(translation);
  pentagon.scale(1 / (2 ** resolution));
  pentagon.transform(QUINTANT_ROTATIONS[quintant]);

  return pentagon;
}

// TODO: memoize these two functions?
export function getQuintantVertices(quintant: number): PentagonShape {
  const triangle = TRIANGLE.clone();
  triangle.transform(QUINTANT_ROTATIONS[quintant]);
  return triangle;
}

export function getFaceVertices(): PentagonShape {
  const vertices: vec2[] = [];
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
// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { vec3 } from 'gl-matrix';
import type { Cartesian } from '../core/coordinate-systems';

const midpointAB = vec3.create() as Cartesian;
const crossCD = vec3.create();
const scaledA = vec3.create();
const scaledB = vec3.create();

/**
 * Returns a difference measure between two vectors, a - b
 * D = sqrt(1 - dot(a,b)) / sqrt(2)
 * D = 1: a and b are perpendicular
 * D = 0: a and b are the same
 * D = NaN: a and b are opposite (shouldn't happen in IVEA as we're using normalized vectors in the same hemisphere)
 * 
 * D is a measure of the angle between the two vectors. sqrt(2) can be ignored when comparing ratios.
 * 
 * @param A - The first vector
 * @param B - The second vector
 * @returns The difference between the two vectors
 */
export function vectorDifference(A: Cartesian, B: Cartesian): number {
  // Original implementation is unstable for small angles as dot(A, B) approaches 1
  //return Math.sqrt(1 - vec3.dot(A, B));

  // dot(A, B) = cos(x) as A and B are normalized
  // Using double angle formula for cos(2x) = 1 - 2sin(x)^2, can rewrite as:
  // 1 - cos(x) = 2 * sin(x/2)^2)
  //            = 2 * sin(x/2)^2
  // ⇒ sqrt(1 - cos(x)) = sqrt(2) * sin(x/2) 
  // Angle x/2 can be obtained as the angle between A and the normalized midpoint of A and B
  // ⇒ sin(x/2) = |cross(A, midpointAB)|
  vec3.lerp(midpointAB, A, B, 0.5);
  vec3.normalize(midpointAB, midpointAB);
  vec3.cross(midpointAB, A, midpointAB);
  const D = vec3.length(midpointAB);

  // Math.sin(x) = x for x < 1e-8
  if (D < 1e-8) {
    // When A and B are close or equal sin(x/2) ≈ x/2, just take the half-distance between A and B
    const AB = vec3.subtract(vec3.create(), A, B);
    const halfDistance = 0.5 * vec3.length(AB);
    return halfDistance;
  }
  return D;
}

/**
 * Computes the triple product of four vectors
 * @param A - The first vector
 * @param B - The second vector
 * @param C - The third vector
 * @returns The scalar result
 */
export function tripleProduct(A: Cartesian, B: Cartesian, C: Cartesian): number {
  vec3.cross(crossCD, B, C);
  return vec3.dot(A, crossCD);
}

/**
 * Computes the quadruple product of four vectors
 * @param out - The target vector to write the result to
 * @param A - The first vector
 * @param B - The second vector
 * @param C - The third vector
 * @param D - The fourth vector
 * @returns The result vector (same as out)
 */
export function quadrupleProduct(out: Cartesian, A: Cartesian, B: Cartesian, C: Cartesian, D: Cartesian): Cartesian {
  vec3.cross(crossCD, C, D);
  const tripleProductACD = vec3.dot(A, crossCD);
  const tripleProductBCD = vec3.dot(B, crossCD);
  vec3.scale(scaledA, A, tripleProductBCD);
  vec3.scale(scaledB, B, tripleProductACD);
  return vec3.sub(out, scaledB, scaledA) as Cartesian;
}

/**
 * Spherical linear interpolation between two vectors
 * @param out - The target vector to write the result to
 * @param A - The first vector
 * @param B - The second vector
 * @param t - The interpolation parameter (0 to 1)
 * @returns The interpolated vector (same as out)
 */
export function slerp(out: Cartesian, A: Cartesian, B: Cartesian, t: number): Cartesian {
  const gamma = vec3.angle(A, B);
  if (gamma < 1e-12) {
    return vec3.lerp(out, A, B, t) as Cartesian;
  }
  const weightA = Math.sin((1 - t) * gamma) / Math.sin(gamma);
  const weightB = Math.sin(t * gamma) / Math.sin(gamma);
  const scaledA = vec3.scale(vec3.create(), A, weightA);
  const scaledB = vec3.scale(vec3.create(), B, weightB);
  return vec3.add(out, scaledA, scaledB) as Cartesian;
} 
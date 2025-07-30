// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { quat, vec2, glMatrix } from 'gl-matrix';
glMatrix.setMatrixArrayType(Float64Array as any);

const SQRT5 = Math.sqrt(5);
const INV_SQRT5 = Math.sqrt(0.2);

// Dodecahedron face centers (origins) can be defined exactly using trigonometry
// The north and south poles are just at z=1 and z=-1
// Then there are two rings at z = ±INV_SQRT5, with radius 2 * INV_SQRT5

// Exact values for defining a regular pentagon (with radius 1). It is correct to use a radius
// of 1 as we want to obtain the axes of rotations, so the vectors need to be normalized.
// cos0 = 0;
// cos36 = (SQRT5 + 1) / 4;
// cos72 = (SQRT5 - 1) / 4;
// sin0 = 0;
// sin36 = Math.sqrt(10 - 2 * SQRT5) / 4;
// sin72 = Math.sqrt(10 + 2 * SQRT5) / 4;
//
// To compute the quaternion use the equation:
// q = [...sin(alpha) * axis, cos(alpha)]
// where alpha is the half-angle of rotation from the pole to the face center.

// Sin/cosine of half angle (alpha) of rotation from pole to first ring
// For the second ring sin -> cos and cos -> -sin by (pi / 2 - x) identities
const sinAlpha = Math.sqrt((1 - INV_SQRT5) / 2);
const cosAlpha = Math.sqrt((1 + INV_SQRT5) / 2);

// The resulting value simplify a set of expressions. It is much better to compute
// these directly than using trigonometry
const A = 0.5; // sin72 * sinAlpha or sin36 * cosAlpha 
const B = Math.sqrt((2.5 - SQRT5) / 10); // cos72 * sinAlpha 
const C = Math.sqrt((2.5 + SQRT5) / 10); // cos36 * cosAlpha
const D = Math.sqrt((1 + INV_SQRT5) / 8); // cos36 * sinAlpha
const E = Math.sqrt((1 - INV_SQRT5) / 8); // cos72 * cosAlpha
const F = Math.sqrt((3 - SQRT5) / 8); // sin36 * sinAlpha
const G = Math.sqrt((3 + SQRT5) / 8); // sin72 * cosAlpha

// Face centers projected onto the z=0 plane & normalized
// 0: North pole,
// 1-5: First pentagon ring
// 6-10: Second pentagon ring
// 11: South pole
const faceCenters = [
  [0, 0], // Doesn't actually matter as rotation is 0

  // First ring: five vertices, CCW, multiplied by sinAlpha
  [sinAlpha, 0], // [cos0, sin0]
  [B, A], // [cos72, sin72]
  [-D, F], // [-cos36, sin36]
  [-D, -F], // [-cos36, -sin36]
  [B, -A], // [cos72, -sin72]

  // Second ring: the same five vertices but negated (180deg rotation), multiplied by cosAlpha
  [-cosAlpha, 0], // [-cos0, -sin0]
  [-E, -G], // [-cos72, -sin72]
  [C, -A], // [cos36, -sin36]
  [C, A], // [cos36, sin36]
  [-E, G], // [-cos72, sin72]

  [0, 0]
] as vec2[];

// Obtain by cross product with the z-axis
const axes = faceCenters.map(([x, y]) => [-y, x]) as vec2[];

// Quaternions are obtained from axis of rotation & angle of rotation
const quaternions = axes.map((axis, i) => {
  if (i === 0) return [0, 0, 0, 1];
  if (i === 11) return [0, -1, 0, 0]; // TODO better to use 1, 0, 0, 0?
  return [...axis, 0, i < 6 ? cosAlpha : sinAlpha];
}) as quat[];

export { quaternions };
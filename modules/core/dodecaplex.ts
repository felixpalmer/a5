// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { quat, vec2, glMatrix } from 'gl-matrix';
glMatrix.setMatrixArrayType(Float64Array as any);

// Dodecahedron face centeres (origins)can be defined exactly using trigonometry
const SQRT5 = Math.sqrt(5);
const INV_SQRT5 = Math.sqrt(0.2);

const cos0 = 1;
const cos36 = (SQRT5 + 1) / 4;
const cos72 = (SQRT5 - 1) / 4;
const sin0 = 0;
const sin36 = Math.sqrt(10 - 2 * SQRT5) / 4;
const sin72 = Math.sqrt(10 + 2 * SQRT5) / 4;

// Sin/cosine of half angle (alpha) of rotation from pole to first ring
const sinAlpha = Math.sqrt((1 - INV_SQRT5) / 2);
const cosAlpha = Math.sqrt((1 + INV_SQRT5) / 2);

// Expand products for enhanced precision
const cos0sinAlpha = sinAlpha;
const sin0sinAlpha = 0;
const cos0cosAlpha = cosAlpha;
const sin0cosAlpha = 0;

const cos36sinAlpha = sinAlpha;
const sin36sinAlpha = 0;
const cos36cosAlpha = cosAlpha;
const sin36cosAlpha = 0;

// Face centers projected onto the z=0 plane & normalized
// 0: North pole,
// 1-5: First pentagon ring
// 6-10: Second pentagon ring
// 11: South pole
const faceCenters = [
  [0, 0], // Doesn't actually matter as rotation is 0

  [cos0 * sinAlpha, sin0 * sinAlpha],
  [cos72 * sinAlpha, sin72 * sinAlpha],
  [-cos36 * sinAlpha, sin36 * sinAlpha],
  [-cos36 * sinAlpha, -sin36 * sinAlpha],
  [cos72 * sinAlpha, -sin72 * sinAlpha],

  [-cos0 * cosAlpha, -sin0 * cosAlpha],
  [-cos72 * cosAlpha, -sin72 * cosAlpha],
  [cos36 * cosAlpha, -sin36 * cosAlpha],
  [cos36 * cosAlpha, sin36 * cosAlpha],
  [-cos72 * cosAlpha, sin72 * cosAlpha],

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
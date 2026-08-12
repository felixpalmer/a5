// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// Minimal double-precision vec2 helpers, ported verbatim from gl-matrix v3.4.3
// (MIT). Only the operations A5 uses are included; `create` always returns a
// Float64Array so intermediate math stays at double precision.

import type {Vec2, Mat2, Mat2d} from './types';

/** Creates a new, zeroed vec2. */
export function create(): Vec2 {
  return new Float64Array(2);
}

/** Creates a new vec2 initialized with values from an existing vector. */
export function clone(a: Vec2): Vec2 {
  const out = new Float64Array(2);
  out[0] = a[0];
  out[1] = a[1];
  return out;
}

/** Creates a new vec2 initialized with the given values. */
export function fromValues(x: number, y: number): Vec2 {
  const out = new Float64Array(2);
  out[0] = x;
  out[1] = y;
  return out;
}

/** Set the components of a vec2 to the given values. */
export function set(out: Vec2, x: number, y: number): Vec2 {
  out[0] = x;
  out[1] = y;
  return out;
}

/** Adds two vec2's. */
export function add(out: Vec2, a: Vec2, b: Vec2): Vec2 {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  return out;
}

/** Scales a vec2 by a scalar number. */
export function scale(out: Vec2, a: Vec2, b: number): Vec2 {
  out[0] = a[0] * b;
  out[1] = a[1] * b;
  return out;
}

/** Adds two vec2's after scaling the second operand by a scalar value. */
export function scaleAndAdd(out: Vec2, a: Vec2, b: Vec2, scaleBy: number): Vec2 {
  out[0] = a[0] + b[0] * scaleBy;
  out[1] = a[1] + b[1] * scaleBy;
  return out;
}

/** Negates the components of a vec2. */
export function negate(out: Vec2, a: Vec2): Vec2 {
  out[0] = -a[0];
  out[1] = -a[1];
  return out;
}

/** Calculates the length of a vec2. */
export function length(a: Vec2): number {
  return Math.hypot(a[0], a[1]);
}

/** Performs a linear interpolation between two vec2's. */
export function lerp(out: Vec2, a: Vec2, b: Vec2, t: number): Vec2 {
  const ax = a[0],
    ay = a[1];
  out[0] = ax + t * (b[0] - ax);
  out[1] = ay + t * (b[1] - ay);
  return out;
}

/** Rotate a vec2 by an angle (radians) about origin `b`. */
export function rotate(out: Vec2, a: Vec2, b: Vec2, rad: number): Vec2 {
  const p0 = a[0] - b[0],
    p1 = a[1] - b[1],
    sinC = Math.sin(rad),
    cosC = Math.cos(rad);
  out[0] = p0 * cosC - p1 * sinC + b[0];
  out[1] = p0 * sinC + p1 * cosC + b[1];
  return out;
}

/** Transforms the vec2 with a mat2. */
export function transformMat2(out: Vec2, a: Vec2, m: Mat2): Vec2 {
  const x = a[0],
    y = a[1];
  out[0] = m[0] * x + m[2] * y;
  out[1] = m[1] * x + m[3] * y;
  return out;
}

/** Transforms the vec2 with a mat2d. */
export function transformMat2d(out: Vec2, a: Vec2, m: Mat2d): Vec2 {
  const x = a[0],
    y = a[1];
  out[0] = m[0] * x + m[2] * y + m[4];
  out[1] = m[1] * x + m[3] * y + m[5];
  return out;
}

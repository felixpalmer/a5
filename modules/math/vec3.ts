// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// Minimal double-precision vec3 helpers, ported verbatim from gl-matrix v3.4.3
// (MIT). Only the operations A5 uses are included, and `create` always returns
// a Float64Array so intermediate math stays at double precision regardless of
// any host's global gl-matrix configuration.

import type {Vec3, Quat} from './types';

/** Creates a new, zeroed vec3. */
export function create(): Vec3 {
  return new Float64Array(3);
}

/** Creates a new vec3 initialized with values from an existing vector. */
export function clone(a: Vec3): Vec3 {
  const out = new Float64Array(3);
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  return out;
}

/** Creates a new vec3 initialized with the given values. */
export function fromValues(x: number, y: number, z: number): Vec3 {
  const out = new Float64Array(3);
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

/** Set the components of a vec3 to the given values. */
export function set(out: Vec3, x: number, y: number, z: number): Vec3 {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

/** Adds two vec3's. */
export function add(out: Vec3, a: Vec3, b: Vec3): Vec3 {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  out[2] = a[2] + b[2];
  return out;
}

/** Subtracts vector b from vector a. */
export function subtract(out: Vec3, a: Vec3, b: Vec3): Vec3 {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  out[2] = a[2] - b[2];
  return out;
}

/** Scales a vec3 by a scalar number. */
export function scale(out: Vec3, a: Vec3, b: number): Vec3 {
  out[0] = a[0] * b;
  out[1] = a[1] * b;
  out[2] = a[2] * b;
  return out;
}

/** Adds two vec3's after scaling the second operand by a scalar value. */
export function scaleAndAdd(out: Vec3, a: Vec3, b: Vec3, scaleBy: number): Vec3 {
  out[0] = a[0] + b[0] * scaleBy;
  out[1] = a[1] + b[1] * scaleBy;
  out[2] = a[2] + b[2] * scaleBy;
  return out;
}

/** Calculates the length of a vec3. */
export function length(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

/** Calculates the euclidian distance between two vec3's. */
export function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
}

/** Normalize a vec3. */
export function normalize(out: Vec3, a: Vec3): Vec3 {
  const x = a[0];
  const y = a[1];
  const z = a[2];
  let len = x * x + y * y + z * z;
  if (len > 0) {
    len = 1 / Math.sqrt(len);
  }
  out[0] = a[0] * len;
  out[1] = a[1] * len;
  out[2] = a[2] * len;
  return out;
}

/** Calculates the dot product of two vec3's. */
export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Computes the cross product of two vec3's. */
export function cross(out: Vec3, a: Vec3, b: Vec3): Vec3 {
  const ax = a[0],
    ay = a[1],
    az = a[2];
  const bx = b[0],
    by = b[1],
    bz = b[2];
  out[0] = ay * bz - az * by;
  out[1] = az * bx - ax * bz;
  out[2] = ax * by - ay * bx;
  return out;
}

/** Performs a linear interpolation between two vec3's. */
export function lerp(out: Vec3, a: Vec3, b: Vec3, t: number): Vec3 {
  const ax = a[0];
  const ay = a[1];
  const az = a[2];
  out[0] = ax + t * (b[0] - ax);
  out[1] = ay + t * (b[1] - ay);
  out[2] = az + t * (b[2] - az);
  return out;
}

/** Transforms the vec3 with a quat. */
export function transformQuat(out: Vec3, a: Vec3, q: Quat): Vec3 {
  const qx = q[0],
    qy = q[1],
    qz = q[2],
    qw = q[3];
  const x = a[0],
    y = a[1],
    z = a[2];
  // var qvec = [qx, qy, qz]; var uv = vec3.cross([], qvec, a);
  let uvx = qy * z - qz * y,
    uvy = qz * x - qx * z,
    uvz = qx * y - qy * x;
  // var uuv = vec3.cross([], qvec, uv);
  let uuvx = qy * uvz - qz * uvy,
    uuvy = qz * uvx - qx * uvz,
    uuvz = qx * uvy - qy * uvx;
  // vec3.scale(uv, uv, 2 * w);
  const w2 = qw * 2;
  uvx *= w2;
  uvy *= w2;
  uvz *= w2;
  // vec3.scale(uuv, uuv, 2);
  uuvx *= 2;
  uuvy *= 2;
  uuvz *= 2;
  // return vec3.add(out, a, vec3.add(out, uv, uuv));
  out[0] = x + uvx + uuvx;
  out[1] = y + uvy + uuvy;
  out[2] = z + uvz + uuvz;
  return out;
}

/** Alias for {@link subtract}. */
export const sub = subtract;

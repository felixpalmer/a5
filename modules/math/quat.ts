// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// Double-precision quaternion helpers, ported from gl-matrix v3.4.3
// (© 2015-2021 Brandon Jones, Colin MacKenzie IV; MIT). Only the operations A5
// uses are included; every array is a Float64Array (no Float32Array path).

import type {Quat, Vec3} from './types';
import * as vec3 from './vec3';

/** Creates a new identity quat. */
export function create(): Quat {
  const out = new Float64Array(4);
  out[3] = 1;
  return out;
}

/** Calculates the conjugate of a quat (assumes unit length → equals inverse). */
export function conjugate(out: Quat, a: Quat): Quat {
  out[0] = -a[0];
  out[1] = -a[1];
  out[2] = -a[2];
  out[3] = a[3];
  return out;
}

/** Sets a quat from the given axis (assumed normalized) and rotation angle. */
function setAxisAngle(out: Quat, axis: Vec3, rad: number): Quat {
  rad = rad * 0.5;
  const s = Math.sin(rad);
  out[0] = s * axis[0];
  out[1] = s * axis[1];
  out[2] = s * axis[2];
  out[3] = Math.cos(rad);
  return out;
}

/** Normalize a quat. */
function normalize(out: Quat, a: Quat): Quat {
  const x = a[0];
  const y = a[1];
  const z = a[2];
  const w = a[3];
  let len = x * x + y * y + z * z + w * w;
  if (len > 0) {
    len = 1 / Math.sqrt(len);
  }
  out[0] = x * len;
  out[1] = y * len;
  out[2] = z * len;
  out[3] = w * len;
  return out;
}

// Scratch vectors for rotationTo (mirrors gl-matrix's IIFE-captured state).
const tmpvec3 = vec3.create();
const xUnitVec3 = vec3.fromValues(1, 0, 0);
const yUnitVec3 = vec3.fromValues(0, 1, 0);

/**
 * Sets a quaternion to represent the shortest rotation from one unit vector to
 * another. Handles the antipodal case (dot < -0.999999) via an orthogonal axis.
 */
export function rotationTo(out: Quat, a: Vec3, b: Vec3): Quat {
  const dot = vec3.dot(a, b);
  if (dot < -0.999999) {
    vec3.cross(tmpvec3, xUnitVec3, a);
    if (vec3.length(tmpvec3) < 0.000001) vec3.cross(tmpvec3, yUnitVec3, a);
    vec3.normalize(tmpvec3, tmpvec3);
    setAxisAngle(out, tmpvec3, Math.PI);
    return out;
  } else if (dot > 0.999999) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 1;
    return out;
  } else {
    vec3.cross(tmpvec3, a, b);
    out[0] = tmpvec3[0];
    out[1] = tmpvec3[1];
    out[2] = tmpvec3[2];
    out[3] = 1 + dot;
    return normalize(out, out);
  }
}

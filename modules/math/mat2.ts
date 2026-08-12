// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// Minimal double-precision mat2 helpers, ported verbatim from gl-matrix v3.4.3
// (MIT). Column-major 2x2 stored as [m00, m01, m10, m11].

import type {Mat2} from './types';

/** Creates a new identity mat2. */
export function create(): Mat2 {
  const out = new Float64Array(4);
  out[0] = 1;
  out[3] = 1;
  return out;
}

/** Create a new mat2 with the given values. */
export function fromValues(m00: number, m01: number, m10: number, m11: number): Mat2 {
  const out = new Float64Array(4);
  out[0] = m00;
  out[1] = m01;
  out[2] = m10;
  out[3] = m11;
  return out;
}

/** Creates a mat2 from a given angle (radians). */
export function fromRotation(out: Mat2, rad: number): Mat2 {
  const s = Math.sin(rad);
  const c = Math.cos(rad);
  out[0] = c;
  out[1] = s;
  out[2] = -s;
  out[3] = c;
  return out;
}

/** Inverts a mat2. Returns null when the matrix is singular. */
export function invert(out: Mat2, a: Mat2): Mat2 | null {
  const a0 = a[0],
    a1 = a[1],
    a2 = a[2],
    a3 = a[3];
  let det = a0 * a3 - a2 * a1;
  if (!det) {
    return null;
  }
  det = 1.0 / det;
  out[0] = a3 * det;
  out[1] = -a1 * det;
  out[2] = -a2 * det;
  out[3] = a0 * det;
  return out;
}

// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// Double-precision mat2 helpers (column-major 2x2 = [m00, m01, m10, m11]),
// ported from gl-matrix v3.4.3 (© 2015-2021 Brandon Jones, Colin MacKenzie IV;
// MIT). Every array is a Float64Array (no Float32Array path).

import type {Mat2} from './types';

/** Creates a new identity mat2. */
export function create(): Mat2 {
  const out = new Float64Array(4);
  out[0] = 1;
  out[3] = 1;
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

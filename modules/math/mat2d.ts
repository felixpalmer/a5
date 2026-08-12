// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// Minimal double-precision mat2d helper, ported verbatim from gl-matrix v3.4.3
// (MIT). A mat2d is a 2x3 affine transform stored as [a, b, c, d, tx, ty].

import type {Mat2d} from './types';

/** Create a new mat2d with the given values. */
export function fromValues(a: number, b: number, c: number, d: number, tx: number, ty: number): Mat2d {
  const out = new Float64Array(6);
  out[0] = a;
  out[1] = b;
  out[2] = c;
  out[3] = d;
  out[4] = tx;
  out[5] = ty;
  return out;
}

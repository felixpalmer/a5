// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// Double-precision mat2d helper (2x3 affine = [a, b, c, d, tx, ty]), ported
// from gl-matrix v3.4.3 (© 2015-2021 Brandon Jones, Colin MacKenzie IV; MIT).
// Every array is a Float64Array (no Float32Array path).

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

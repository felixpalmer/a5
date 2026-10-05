// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// Double-precision quaternion helpers, ported from gl-matrix v3.4.3
// (© 2015-2021 Brandon Jones, Colin MacKenzie IV; MIT). Only the operations A5
// uses are included; every array is a Float64Array (no Float32Array path).

import type {Quat} from './types';

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

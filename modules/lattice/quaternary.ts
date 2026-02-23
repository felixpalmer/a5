// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { vec2, glMatrix } from 'gl-matrix';
glMatrix.setMatrixArrayType(Float64Array as any);
import type { IJ, KJ } from '../core/coordinate-systems';
import type { Quaternary, Flip } from './types';
import { YES, NO } from './types';

// Using KJ allows simplification of definitions
const kPos = vec2.fromValues(1, 0) as KJ; // k
const jPos = vec2.fromValues(0, 1) as KJ; // j
const kNeg = vec2.negate(vec2.create(), kPos) as KJ;
const jNeg = vec2.negate(vec2.create(), jPos) as KJ;
const ZERO = vec2.fromValues(0, 0) as KJ;

export const quaternaryToKJ = (n: Quaternary, [flipX, flipY]: [Flip, Flip]): KJ => {
  // Indirection to allow for flips
  let p: KJ = ZERO;
  let q: KJ = ZERO;

  if (flipX === NO && flipY === NO) {
    p = kPos;
    q = jPos;
  } else if (flipX === YES && flipY === NO) {
    // Swap and negate
    p = jNeg;
    q = kNeg;
  } else if (flipX === NO && flipY === YES) {
    // Swap only
    p = jPos;
    q = kPos;
  } else if (flipX === YES && flipY === YES) {
    // Negate only
    p = kNeg;
    q = jNeg;
  }

  switch(n) {
    case 0:
      return ZERO; // Length 0
    case 1:
      return p; // Length 1
    case 2:
      return vec2.add(vec2.create(), q, p) as KJ; // Length SQRT2
    case 3:
      return vec2.scaleAndAdd(vec2.create(), q, p, 2) as KJ // Length SQRT5
    default:
      throw new Error(`Invalid Quaternary value: ${n}`);
  }
}

export const quaternaryToFlips = (n: Quaternary): [Flip, Flip] => {
  return [[NO, NO], [NO, YES], [NO, NO], [YES, NO]][n] as [Flip, Flip];
}

// This function uses the ij basis, unlike its inverse!
export const IJToQuaternary = ([i, j]: IJ, flips: [Flip, Flip]): Quaternary => {
  let digit: Quaternary = 0;

  // Boundaries to compare against
  let a = flips[0] === YES ? -(i + j) : i + j;
  let b = flips[1] === YES ? -i : i;
  let c = flips[0] === YES ? -j : j;

  // Only one flip
  if (flips[0] + flips[1] === 0) {
    if (c < 1) { digit = 0; }
    else if (b > 1) { digit = 3; }
    else if (a > 1) { digit = 2; }
    else { digit = 1 }
  // No flips or both
  } else {
    if (a < 1) { digit = 0; }
    else if (b > 1) { digit = 3; }
    else if (c > 1) { digit = 2; }
    else { digit = 1; }
  }

  return digit;
}

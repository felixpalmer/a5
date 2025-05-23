// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { vec2, glMatrix } from 'gl-matrix';
glMatrix.setMatrixArrayType(Float64Array as any);
import { IJ, KJ } from './coordinate-systems';

export type Quaternary = 0 | 1 | 2 | 3;
export const YES = -1 as const;
export const NO = 1 as const;
export type Flip = typeof YES | typeof NO;
export type Anchor = { k: Quaternary, offset: IJ; flips: [flipX: Flip, flipY: Flip]; }

// Anchor offset is specified in ij units, the eigenbasis of the Hilbert curve
// Define k as the vector i + j, as it means vectors u & v are of unit length
export const IJToKJ = ([i, j]: IJ): KJ => {
  return vec2.fromValues(i + j, j) as KJ;
}

export const KJToIJ = ([k, j]: KJ): IJ => {
  return vec2.fromValues(k - j, j) as IJ;
}

/**
 * Orientation of the Hilbert curve. The curve fills a space defined by the triangle with vertices
 * u, v & w. The orientation describes which corner the curve starts and ends at, e.g. wv is a
 * curve that starts at w and ends at v.
 */
export type Orientation = 'uv' | 'vu' | 'uw' | 'wu' | 'vw' | 'wv';

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

const FLIP_SHIFT = vec2.fromValues(-1, 1) as IJ;

export const sToAnchor = (s: number | bigint, resolution: number, orientation: Orientation): Anchor => {
  let input = BigInt(s);
  const reverse = orientation === 'vu' || orientation === 'wu' || orientation === 'vw';
  const invertJ = orientation === 'wv' || orientation === 'vw';
  const flipIJ = orientation === 'wu' || orientation === 'uw';
  if (reverse) {
    input = (1n << BigInt(2 * resolution)) - input - 1n;
  }
  const anchor = _sToAnchor(input);
  if (flipIJ) {
    const { offset: [_i, _j], flips: [flipX, flipY] } = anchor;
    anchor.offset = [_j, _i] as IJ;

    // The flips moved the origin of the cell, shift to compensate
    if (flipX === YES) vec2.add(anchor.offset, anchor.offset, FLIP_SHIFT);
    if (flipY === YES) vec2.subtract(anchor.offset, anchor.offset, FLIP_SHIFT);
  }
  if (invertJ) {
    const { offset: [i, _j], flips } = anchor;

    const j = (1 << resolution) - (i + _j);
    flips[0] = -flips[0] as Flip;
    anchor.offset[1] = j;
    anchor.flips = flips;
  }
  return anchor;
}

export const _sToAnchor = (s: number | bigint): Anchor => {
  const k = Number(s) % 4 as Quaternary;
  const offset = vec2.create() as KJ;
  const flips = [NO, NO] as [Flip, Flip];
  let input = BigInt(s);
  
  // Get all quaternary digits first
  const digits: Quaternary[] = [];
  while (input > 0n) {
    digits.push(Number(input % 4n) as Quaternary);
    input = input >> 2n;
  }
  
  // Process digits from left to right (most significant first)
  for (let i = digits.length - 1; i >= 0; i--) {
    // Scale up existing anchor
    vec2.scale(offset, offset, 2);
    
    // Get child anchor and combine with current anchor
    const childOffset = quaternaryToKJ(digits[i], flips);
    vec2.add(offset, offset, childOffset);
    vec2.multiply(flips, flips, quaternaryToFlips(digits[i]));
  }

  return {flips, k, offset: KJToIJ(offset)};
}

// Get the number of digits needed to represent the offset
// As we don't know the flips we need to add 2 to include the next row
export const getRequiredDigits = (offset: vec2): number => {
  const indexSum = Math.ceil(offset[0]) + Math.ceil(offset[1]); // TODO perhaps use floor instead
  if (indexSum === 0) return 1;
  return 1 + Math.floor(Math.log2(indexSum));
}

// This function uses the ij basis, unlike its inverse!
export const IJtoQuaternary = ([u, v]: IJ, flips: [Flip, Flip]): Quaternary => {
  let digit: Quaternary = 0;

  // Boundaries to compare against
  let a = flips[0] === YES ? -(u + v) : u + v;
  let b = flips[1] === YES ? -u : u;
  let c = flips[0] === YES ? -v : v;

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

export const IJToS = (input: IJ, resolution: number, orientation: Orientation = 'uv'): bigint => {
  const reverse = orientation === 'vu' || orientation === 'wu' || orientation === 'vw';
  const invertJ = orientation === 'wv' || orientation === 'vw';
  const flipIJ = orientation === 'wu' || orientation === 'uw';
  
  let ij = [...input] as IJ;
  if (flipIJ) {
    ij[0] = input[1];
    ij[1] = input[0];
  }
  if (invertJ) {
    const [i, j] = ij;
    ij[1] = (1 << resolution) - (i + j);
  }
  
  let S = _IJToS(ij);
  if (reverse) {
    S = (1n << BigInt(2 * resolution)) - S - 1n;
  }
  return S;
}

export const _IJToS = (input: IJ): bigint => {
  // Get number of digits we need to process
  const numDigits = getRequiredDigits(input);
  const digits: Quaternary[] = new Array(numDigits);

  const flips: [Flip, Flip] = [NO, NO];
  const pivot = vec2.create() as IJ;

  // Process digits from left to right (most significant first)
  for (let i = 0; i < numDigits; i++) {
    const relativeOffset = vec2.subtract(vec2.create(), input, pivot) as IJ;

    const scale = 1 << (numDigits - 1 - i);
    const scaledOffset = vec2.scale(vec2.create(), relativeOffset, 1 / scale) as IJ;

    const digit = IJtoQuaternary(scaledOffset, flips);
    digits[i] = digit;

    // Update running state
    const childOffset = KJToIJ(quaternaryToKJ(digit, flips));
    const upscaledChildOffset = vec2.scale(vec2.create(), childOffset, scale);
    vec2.add(pivot, pivot, upscaledChildOffset);
    vec2.multiply(flips, flips, quaternaryToFlips(digit));
  }

  let output = 0n;
  for (let i = 0; i < numDigits; i++) {
    const scale = 1n << BigInt(2 * (numDigits - 1 - i));
    output += BigInt(digits[i]) * scale;
  }

  return output;
}
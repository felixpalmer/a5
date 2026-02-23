// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { vec2, glMatrix } from 'gl-matrix';
glMatrix.setMatrixArrayType(Float64Array as any);
import type { IJ, KJ } from '../core/coordinate-systems';
import type { Anchor, Quaternary, Flip, Orientation } from './types';
import { YES, NO } from './types';
import { KJToIJ } from './basis';
import { quaternaryToKJ, quaternaryToFlips, IJToQuaternary } from './quaternary';
import { shiftDigits, PATTERN, PATTERN_FLIPPED, PATTERN_REVERSED, PATTERN_FLIPPED_REVERSED } from './shift-digits';

const FLIP_SHIFT = vec2.fromValues(-1, 1) as IJ;


const SHIFTDIGITS = true;

export const sToAnchor = (s: number | bigint, resolution: number, orientation: Orientation, doShiftDigits: boolean = SHIFTDIGITS): Anchor => {
  let input = BigInt(s);
  const reverse = orientation === 'vu' || orientation === 'wu' || orientation === 'vw';
  const invertJ = orientation === 'wv' || orientation === 'vw';
  const flipIJ = orientation === 'wu' || orientation === 'uw';
  if (reverse) {
    input = (1n << BigInt(2 * resolution)) - input - 1n;
  }
  const anchor = _sToAnchor(input, resolution, invertJ, flipIJ, doShiftDigits);
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

const _sToAnchor = (s: number | bigint, resolution: number, invertJ: boolean, flipIJ: boolean, doShiftDigits: boolean = SHIFTDIGITS): Anchor => {
  const offset = vec2.create() as KJ;
  const flips = [NO, NO] as [Flip, Flip];
  let input = BigInt(s);

  // Get all quaternary digits first
  const digits: Quaternary[] = [];
  while (input > 0n || digits.length < resolution) {
    digits.push(Number(input % 4n) as Quaternary);
    input = input >> 2n;
  }

  const pattern = flipIJ ? PATTERN_FLIPPED : PATTERN;

  // Process digits from left to right (most significant first)
  for (let i = digits.length - 1; i >= 0; i--) {
    if (doShiftDigits) {
      shiftDigits(digits, i, flips, invertJ, pattern);
    }
    vec2.multiply(flips, flips, quaternaryToFlips(digits[i]));
  }

  flips[0] = NO; flips[1] = NO; // Reset flips for the next loop
  for (let i = digits.length - 1; i >= 0; i--) {
    // Scale up existing anchor
    vec2.scale(offset, offset, 2);

    // Get child anchor and combine with current anchor
    const childOffset = quaternaryToKJ(digits[i], flips);
    vec2.add(offset, offset, childOffset);
    vec2.multiply(flips, flips, quaternaryToFlips(digits[i]));
  }

  const q = digits[0] || 0 as Quaternary;

  return { q, offset: KJToIJ(offset), flips };
}

export const IJToS = (input: IJ, resolution: number, orientation: Orientation = 'uv', doShiftDigits: boolean = SHIFTDIGITS): bigint => {
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

  let S = _IJToS(ij, invertJ, flipIJ, resolution, doShiftDigits);
  if (reverse) {
    S = (1n << BigInt(2 * resolution)) - S - 1n;
  }
  return S;
}

const _IJToS = (input: IJ, invertJ: boolean, flipIJ: boolean, resolution: number, doShiftDigits: boolean = SHIFTDIGITS): bigint => {
  // Get number of digits we need to process
  const numDigits = resolution;
  const digits: Quaternary[] = new Array(numDigits);

  const flips: [Flip, Flip] = [NO, NO];
  const pivot = vec2.create() as IJ;

  // Process digits from left to right (most significant first)
  for (let i = numDigits - 1; i >= 0; i--) {
    const relativeOffset = vec2.subtract(vec2.create(), input, pivot) as IJ;

    const scale = 1 << i;
    const scaledOffset = vec2.scale(vec2.create(), relativeOffset, 1 / scale) as IJ;

    const digit = IJToQuaternary(scaledOffset, flips);
    digits[i] = digit;

    // Update running state
    const childOffset = KJToIJ(quaternaryToKJ(digit, flips));
    const upscaledChildOffset = vec2.scale(vec2.create(), childOffset, scale);
    vec2.add(pivot, pivot, upscaledChildOffset);
    vec2.multiply(flips, flips, quaternaryToFlips(digit));
  }

  const pattern = flipIJ ? PATTERN_FLIPPED_REVERSED : PATTERN_REVERSED;

  for (let i = 0; i < digits.length; i++) {
    vec2.multiply(flips, flips, quaternaryToFlips(digits[i]));
    if (doShiftDigits) {
      shiftDigits(digits, i, flips, invertJ, pattern);
    }
  }

  let output = 0n;
  for (let i = numDigits - 1; i >= 0; i--) {
    const scale = 1n << BigInt(2 * i);
    output += BigInt(digits[i]) * scale;
  }

  return output;
}

export const IJToFlips = (input: IJ, resolution: number): [flipX: Flip, flipY: Flip] => {
  // Get number of digits we need to process
  const numDigits = resolution;

  const flips: [Flip, Flip] = [NO, NO];
  const pivot = vec2.create() as IJ;

  // Process digits from left to right (most significant first)
  for (let i = numDigits - 1; i >= 0; i--) {
    const relativeOffset = vec2.subtract(vec2.create(), input, pivot) as IJ;

    const scale = 1 << i;
    const scaledOffset = vec2.scale(vec2.create(), relativeOffset, 1 / scale) as IJ;

    const digit = IJToQuaternary(scaledOffset, flips);

    // Update running state
    const childOffset = KJToIJ(quaternaryToKJ(digit, flips));
    const upscaledChildOffset = vec2.scale(vec2.create(), childOffset, scale);
    vec2.add(pivot, pivot, upscaledChildOffset);
    vec2.multiply(flips, flips, quaternaryToFlips(digit));
  }

  return flips;
}

// Precomputed probe offsets for anchorToS(), indexed by flip combination.
// Index = (1 - flip0) + (1 - flip1) / 2, mapping [NO,NO]→0, [NO,YES]→1, [YES,NO]→2, [YES,YES]→3
// Angles chosen as midpoints of validated ranges (res 3-9, all orientations):
//   [NO,NO]:  45° (range 1°-89°)    [NO,YES]: 113° (range 91°-134°)
//   [YES,NO]: 293° (range 271°-314°) [YES,YES]: 225° (range 181°-269°)
const PROBE_R = 0.1;
const PROBE_OFFSETS: [number, number][] = [
  [PROBE_R * Math.cos(45 * Math.PI / 180), PROBE_R * Math.sin(45 * Math.PI / 180)],
  [PROBE_R * Math.cos(113 * Math.PI / 180), PROBE_R * Math.sin(113 * Math.PI / 180)],
  [PROBE_R * Math.cos(293 * Math.PI / 180), PROBE_R * Math.sin(293 * Math.PI / 180)],
  [PROBE_R * Math.cos(225 * Math.PI / 180), PROBE_R * Math.sin(225 * Math.PI / 180)],
];

/**
 * Convert an anchor to an s-value using a single targeted fractional offset probe.
 *
 * IJToS discretizes fractional offsets into Hilbert curve cells. At integer
 * offsets (vertices of the triangular lattice), 6 triangular cells meet.
 * The flip values determine which triangular cell the anchor belongs to,
 * allowing a single probe in the correct direction.
 *
 * Probe directions by flip combination (angle ranges verified at res 3-9, all orientations):
 * - [NO, NO]:   45° (valid 1°-89°)
 * - [YES, NO]:  293° (valid 271°-314°)
 * - [NO, YES]:  113° (valid 91°-134°)
 * - [YES, YES]: 225° (valid 181°-269°)
 */
export const anchorToS = (anchor: Anchor, resolution: number, orientation: Orientation = 'uv'): bigint => {
  const [i, j] = anchor.offset;
  const probeOffset = PROBE_OFFSETS[(1 - anchor.flips[0]) + (1 - anchor.flips[1]) / 2];
  return IJToS(
    [i + probeOffset[0], j + probeOffset[1]] as IJ,
    resolution,
    orientation
  );
}

// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type { Quaternary, Flip } from './types';

// Patterns used to rearrange the cells when shifting. This adjusts the layout so that
// children always overlap with their parent cells.
export function reversePattern(pattern: number[]): number[] {
  return Array.from({length: pattern.length}, (_, i) => pattern.indexOf(i));
}

export const PATTERN = [0, 1, 3, 4, 5, 6, 7, 2];
export const PATTERN_FLIPPED = [0, 1, 2, 7, 3, 4, 5, 6];
export const PATTERN_REVERSED = reversePattern(PATTERN);
export const PATTERN_FLIPPED_REVERSED = reversePattern(PATTERN_FLIPPED);

export const shiftDigits = (
  digits: Quaternary[],
  i: number,
  flips: [Flip, Flip],
  invertJ: boolean,
  pattern: number[]
): void => {
  if (i <= 0) return;

  const parentK = digits[i] || 0;
  const childK = digits[i - 1];
  const F = flips[0] + flips[1];

  // Detect when cells need to be shifted
  let needsShift: boolean = true;
  let first: boolean = true;

  // The value of F which cells need to be shifted
  // The rule is flipped depending on the orientation, specifically on the value of invertJ
  if (invertJ !== (F === 0)) {
    needsShift = parentK === 1 || parentK === 2; // Second & third pentagons only
    first = parentK === 1; // Second pentagon is first
  } else {
    needsShift = parentK < 2; // First two pentagons only
    first = parentK === 0; // First pentagon is first
  }
  if (!needsShift) return;

  // Apply the pattern by setting the digits based on the value provided
  const src = first ? childK : childK + 4;
  const dst = pattern[src];
  digits[i - 1] = dst % 4 as Quaternary;
  digits[i] = (parentK + 4 + Math.floor(dst / 4) - Math.floor(src / 4)) % 4 as Quaternary;
}

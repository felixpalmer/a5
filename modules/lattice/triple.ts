// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type { IJ } from '../core/coordinate-systems';
import type { Anchor, Orientation } from './types';
import { YES, NO } from './types';
import { offsetFlipsToAnchor } from './anchor';
import { sToAnchor, anchorToS, IJToS, IJToFlips } from './hilbert';

/**
 * Triple coordinates for the triangular grid underlying the pentagonal A5 grid.
 *
 * Neighbors differ by ±1 in exactly one coordinate while the other two stay constant.
 * Triple coordinates are orientation-independent — the same geometric cell always has
 * the same triple coords regardless of Hilbert curve orientation.
 */
export type Triple = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

/** The parity of a triple (0 or 1), equal to x + y + z. */
export function tripleParity(t: Triple): number {
  return t.x + t.y + t.z;
}

/** Check if a triple is within valid quintant bounds. */
export function tripleInBounds(t: Triple, maxRow: number): boolean {
  const sum = t.x + t.y + t.z;
  if (sum !== 0 && sum !== 1) return false;
  const limit = t.y - sum;
  return t.x <= 0 && t.z <= 0 && t.y >= 0 && t.y <= maxRow && t.x >= -limit && t.z >= -limit;
}

/**
 * Convert triple coordinates to an s-value (Hilbert index).
 * Convenience function combining tripleToAnchor() + anchorToS().
 *
 * @returns s-value, or null if the triple has invalid parity
 */
export function tripleToS(t: Triple, resolution: number, orientation: Orientation = 'uv'): bigint | null {
  const anchor = tripleToAnchor(t, resolution, orientation);
  if (!anchor) return null;
  return anchorToS(anchor, resolution, orientation);
}

/**
 * Compute triple coordinates from an anchor.
 *
 * This maps the pentagonal A5 grid to a triangular grid coordinate system where
 * neighbors differ by ±1 in exactly one coordinate while the other two stay constant.
 */
export function anchorToTriple(anchor: Anchor): Triple {
  // Start with shift in IJ space
  let shiftI = 0.25;
  let shiftJ = 0.25;
  const [flip0, flip1] = anchor.flips;

  // First check for [1, -1] rotation
  if (flip0 === NO && flip1 === YES) {
    // Rotate 180 degrees
    shiftI = -shiftI;
    shiftJ = -shiftJ;
  }

  // Then apply additional adjustments
  if (flip0 === YES && flip1 === YES) {
    // Rotate 180 degrees
    shiftI = -shiftI;
    shiftJ = -shiftJ;
  } else if (flip0 === YES) {
    // Shift left (subtract w = [0, 1])
    shiftJ -= 1;
  } else if (flip1 === YES) {
    // Shift right (add w = [0, 1])
    shiftJ += 1;
  }

  // Compute center
  const i = anchor.offset[0] + shiftI;
  const j = anchor.offset[1] + shiftJ;

  // Compute row and column in triangular grid
  const r = (i + j) - 0.5;
  const c = (i - j) + r;

  // Compute triple coordinates
  const x = Math.floor((c + 1) / 2 - r);
  const y = r;
  const z = Math.floor((1 - c) / 2);

  return {x, y, z};
}

/**
 * Convert triple coordinates to an Anchor.
 *
 * This is the inverse of anchorToTriple(). For uv/vu orientations, uses
 * a fast path via IJToFlips (7x faster). For other orientations, falls back to
 * IJToS → sToAnchor which handles all orientation transforms.
 *
 * @param t - Triple coordinates
 * @param resolution - Resolution level
 * @param orientation - Hilbert curve orientation (default: 'uv')
 * @returns Anchor if valid, null otherwise
 */
export function tripleToAnchor(t: Triple, resolution: number, orientation: Orientation = 'uv'): Anchor | null {
  const { x, y, z } = t;

  // Verify parity constraint
  const sum = x + y + z;
  if (sum !== 0 && sum !== 1) {
    return null;
  }

  // Compute r and c from triple coordinates
  const r = y;
  const cMin = Math.max(2 * x + 2 * r - 1, -2 * z - 1 + 0.0001);
  const cMax = Math.min(2 * x + 2 * r + 1 - 0.0001, 1 - 2 * z);
  const c = Math.round((cMin + cMax) / 2);

  // Compute center IJ coordinates from r and c
  // From forward: r = centerI + centerJ - 0.5, c = centerI - centerJ + r
  // Solving: centerI = (c + 0.5) / 2, centerJ = r - c/2 + 0.25
  const centerI = (c + 0.5) / 2;
  const centerJ = r - c / 2 + 0.25;

  // Fast path for uv/vu: use IJToFlips directly (works in raw IJ space)
  // This gives around a ~30% speedup on gridDisk/sphericalCap operations
  if (orientation === 'uv' || orientation === 'vu') {
    const flips = IJToFlips([centerI, centerJ] as IJ, resolution);

    // Compute shift from flips (inverse of anchorToTriple logic)
    let shiftI = 0.25;
    let shiftJ = 0.25;
    if (flips[0] === NO && flips[1] === YES) { shiftI = -shiftI; shiftJ = -shiftJ; }
    if (flips[0] === YES && flips[1] === YES) { shiftI = -shiftI; shiftJ = -shiftJ; }
    else if (flips[0] === YES) { shiftJ -= 1; }
    else if (flips[1] === YES) { shiftJ += 1; }

    const offset = [Math.round(centerI - shiftI), Math.round(centerJ - shiftJ)] as IJ;
    return offsetFlipsToAnchor(offset, flips, orientation);
  }

  // General path: IJToS → sToAnchor (handles all orientation transforms)
  const s = IJToS([centerI, centerJ] as IJ, resolution, orientation);
  return sToAnchor(s, resolution, orientation);
}

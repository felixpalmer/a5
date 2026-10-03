// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type {Orientation, Triple} from './types';
import {tripleToSLattice} from './lsystem';

export type {Triple};

/** The parity of a triple (0 or 1), equal to x + y + z. */
export function tripleParity(t: Triple): number {
  return t.x + t.y + t.z;
}

// The pentagon flavor is a CLOSED FORM of the triple. The A5 tiling is gyro
// applied to the square grid R left when every lattice edge parallel to the
// quintant's dodecahedron edge is deleted (A5 = g o^r D in Conway notation).
// Bit 0 is the triangle's parity (which half of its rhombus it is); bit 1 is
// the colour of its apex in the 2-colouring of R, coloured from a dodecahedron
// vertex. The apex of either triangle in unit square (m, n) has colour
// (m + n + maxRow + 1) & 1, and x + z = -(m + n). For maxRow + 1 even (every
// resolution but 0) face centres and vertices share a colour, so bit 1 is just
// (x + z) & 1; at resolution 0 they differ, which gives the corner cell flavor 2.
// Verified against the descent's flavor over all cells (tests/lattice/curve.test.ts).

/** The pentagon flavor (0-3) of a triple's cell — orientation-independent. */
export function tripleFlavor(t: Triple, maxRow: number): number {
  return (t.x + t.y + t.z) | (((maxRow + 1 + t.x + t.z) & 1) << 1);
}

/** Check if a triple is within valid quintant bounds. */
export function tripleInBounds(t: Triple, maxRow: number): boolean {
  const sum = t.x + t.y + t.z;
  if (sum !== 0 && sum !== 1) return false;
  const limit = t.y - sum;
  return t.x <= 0 && t.z <= 0 && t.y >= 0 && t.y <= maxRow && t.x >= -limit && t.z >= -limit;
}

/**
 * Convert triple coordinates to an s-value on the A5 (L-system) curve.
 * The engine's `lattice.tripleToS` is currently the compat alias; this is the
 * pure-curve form it swaps to at the canonical cutover.
 *
 * @returns s-value, or null if the triple has invalid parity
 */
export function tripleToS(t: Triple, resolution: number, orientation: Orientation = 'uv'): bigint | null {
  const sum = t.x + t.y + t.z;
  if (sum !== 0 && sum !== 1) return null;
  return tripleToSLattice(t, resolution, orientation);
}

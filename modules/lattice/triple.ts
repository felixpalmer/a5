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

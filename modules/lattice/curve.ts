// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// Public A5 space-filling curve: point -> s, using the L-system curve
// (modules/lattice/lsystem/). The s <-> cell mappings live in lsystem/index.ts
// (sToCell / sToTriple) and triple.ts (tripleToS).

import type {IJ} from '../core/coordinate-systems';
import type {Orientation, Triple} from './types';
import {tripleToSLattice} from './lsystem';
import {POW2} from './lsystem/tables';

/**
 * Locate the lattice triangle containing a fractional IJ point, as a triple.
 *
 * The triples tile the IJ plane as triangles: the unit square (m, n) =
 * (floor(i), floor(j)) splits along the diagonal u+v = 1 into a lower triangle
 * (the parity-0 cell (-n, m+n, -m), centroid (m+1/3, n+1/3)) and an upper
 * triangle (the parity-1 cell (-n, m+n+1, -m), centroid (m+2/3, n+2/3)) — the
 * centroid correspondences follow from the exact IJ <-> corner-sum affine map
 * (see the note on {@link IJToS}). So point location is two floors + one
 * diagonal comparison. Points exactly on a triangle edge have no unique cell;
 * the >= tie-break below is the fixed convention.
 *
 * The result is clamped into quintant bounds (m >= 0, n >= 0, m+n+parity <=
 * maxRow, equivalent to tripleInBounds): a point slightly outside the quintant
 * (as the estimate path can produce near quintant edges) must still map to a
 * valid cell for the exact encode.
 */
export function roundToTriple(ij: IJ, resolution: number): Triple {
  const maxRow = POW2[resolution] - 1;
  let m = Math.floor(ij[0]);
  let n = Math.floor(ij[1]);
  let parity = ij[0] - m + (ij[1] - n) >= 1 ? 1 : 0;
  if (m < 0) m = 0;
  if (n < 0) n = 0;
  if (m + n + parity > maxRow) {
    parity = 0;
    if (m + n > maxRow) {
      const over = m + n - maxRow;
      const dm = Math.min(m, over);
      m -= dm;
      n -= over - dm;
    }
  }
  return {x: -n, y: m + n + parity, z: -m};
}

/**
 * Fractional IJ point -> curve position `s` of the containing cell: triangular
 * point location ({@link roundToTriple}) followed by the exact branchless
 * encode. Replaces the per-level footprint-containment descent — one rounding
 * for the whole point instead of a ~4-hull scan per level.
 *
 * Note on frames: the IJ plane maps onto the L-system's corner-sum frame by
 * the exact affine map target = (12*(i+j), -12*j) — derived by matching cell
 * centroids across the two frames (parity-0 cell (x,y,z): centroid (x+y+1/3,
 * -x+1/3) in IJ, corner sum (12y+8, 12x-4); parity-1: (x+y-1/3, -x+2/3) and
 * (12y+4, 12x-8); both fit sum = (12(i+j), -12j) exactly), and validated
 * against the old-engine discretization over all resolutions and orientations.
 */
export const IJToS = (ij: IJ, resolution: number, orientation: Orientation = 'uv'): bigint =>
  tripleToSLattice(roundToTriple(ij, resolution), resolution, orientation);

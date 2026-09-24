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
 * centroid correspondences were derived from the exact IJ <-> corner-sum
 * affine map target = (12*(i+j), -12*j) and validated against the old-engine
 * discretization over all resolutions and orientations. Point location is two floors + one
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

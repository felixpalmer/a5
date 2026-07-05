// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// Public A5 space-filling curve: point -> s, using the L-system curve
// (modules/lattice/lsystem/). The s <-> cell mappings live in lsystem/index.ts
// (sToCell / sToTriple) and triple.ts (tripleToS).

import type {IJ} from '../core/coordinate-systems';
import type {Orientation} from './types';
import {sumPointToS} from './lsystem';

/**
 * Fractional IJ point -> curve position `s` of the containing cell, by direct
 * L-system descent. The IJ plane maps onto the L-system's corner-sum frame by
 * the exact affine map target = (12*(i+j), -12*j) — derived by matching cell
 * centroids across the two frames (parity-0 cell (x,y,z): centroid (x+y+1/3,
 * -x+1/3) in IJ, corner sum (12y+8, 12x-4); parity-1: (x+y-1/3, -x+2/3) and
 * (12y+4, 12x-8); both fit sum = (12(i+j), -12j) exactly), and validated
 * against the old-engine discretization over all resolutions and orientations.
 */
export const IJToS = (ij: IJ, resolution: number, orientation: Orientation = 'uv'): bigint =>
  sumPointToS(12 * (ij[0] + ij[1]), -12 * ij[1], resolution, orientation);

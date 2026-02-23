// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { vec2, glMatrix } from 'gl-matrix';
glMatrix.setMatrixArrayType(Float64Array as any);
import type { IJ, KJ } from '../core/coordinate-systems';

// Anchor offset is specified in ij units, the eigenbasis of the Hilbert curve
// Define k as the vector i + j, as it means vectors u & v are of unit length
export const IJToKJ = ([i, j]: IJ): KJ => {
  return vec2.fromValues(i + j, j) as KJ;
}

export const KJToIJ = ([k, j]: KJ): IJ => {
  return vec2.fromValues(k - j, j) as IJ;
}

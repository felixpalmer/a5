// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {AUTHALIC_AREA_EARTH} from './constants';
import {FIRST_HILBERT_RESOLUTION} from './serialization';

/**
 * Returns the number of cells at a given resolution.
 * 
 * @param resolution The resolution level (use BigInt for exact value for high resolutions, 28+)
 * @returns Number of cells at the given resolution
 */
export function getNumCells(resolution: number): number;
export function getNumCells(resolution: bigint): bigint;
export function getNumCells(resolution: number | bigint): number | bigint {
  if (typeof resolution === 'bigint') {
    if (resolution < 0n) return 0n;
    if (resolution === 0n) return 12n;
    return 60n * (4n ** (resolution - 1n));
  } else {
    if (resolution < 0) return 0;
    if (resolution === 0) return 12;
    return 60 * (4 ** (resolution - 1));
  }
}

export function getNumChildren(parentResolution: number, childResolution: number): number {
  if (childResolution < parentResolution) return 0;
  if (childResolution === parentResolution) return 1;
  if (parentResolution >= FIRST_HILBERT_RESOLUTION) {
    // Between levels of constant aperture of 4, relation simplifies
    return 4 ** (childResolution - parentResolution);
  }

  const parentCount = getNumCells(parentResolution) || 1;
  const childCount = getNumCells(childResolution);
  return childCount / parentCount;
}

/**
 * Returns the area of a cell at a given resolution in square meters.
 *
 * @param resolution The resolution level
 * @returns Area of a cell in square meters
 */
export function cellArea(resolution: number): number {
  if (resolution < 0) return AUTHALIC_AREA_EARTH;
  return AUTHALIC_AREA_EARTH / getNumCells(resolution);
} 
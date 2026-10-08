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
    return 60n * 4n ** (resolution - 1n);
  } else {
    if (resolution < 0) return 0;
    if (resolution === 0) return 12;
    return 60 * 4 ** (resolution - 1);
  }
}

/**
 * Returns the number of descendants a cell has at a finer resolution.
 *
 * @param parentResolution The cell's resolution (-1 for the world cell)
 * @param childResolution The resolution of the descendants (use BigInt for
 *   exact values when the count exceeds 2^53)
 * @returns Number of descendants (1 at the same resolution, 0 if coarser)
 */
export function getNumChildren(parentResolution: number, childResolution: number): number;
export function getNumChildren(parentResolution: bigint, childResolution: bigint): bigint;
export function getNumChildren(parentResolution: number | bigint, childResolution: number | bigint): number | bigint {
  if (typeof parentResolution === 'bigint' || typeof childResolution === 'bigint') {
    const parent = BigInt(parentResolution);
    const child = BigInt(childResolution);
    if (child < parent) return 0n;
    if (child === parent) return 1n;
    if (parent >= BigInt(FIRST_HILBERT_RESOLUTION)) return 4n ** (child - parent);
    return getNumCells(child) / (parent < 0n ? 1n : getNumCells(parent));
  }
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

// Mean cell edge length divided by sqrt(cellArea), measured exhaustively from the
// cell boundaries. Resolution 0 cells (dodecahedron faces) have their own
// geometry; from resolution 1 the pentagonal tiling refines self-similarly and
// the ratio converges to ~0.8211, so a constant serves all higher resolutions.
const EDGE_LENGTH_RATIOS = [0.7131, 0.8037, 0.8164, 0.8198, 0.8208, 0.821];
const EDGE_LENGTH_RATIO = 0.8211;

/**
 * Returns the average edge length of a cell at a given resolution in meters.
 * Individual edge lengths vary from the average by roughly ±10%, depending
 * on the cell's shape and its position on the globe.
 *
 * @param resolution The resolution level
 * @returns Average edge length of a cell in meters
 */
export function cellEdgeLengthAvg(resolution: number): number {
  if (resolution < 0) resolution = 0;
  const ratio = EDGE_LENGTH_RATIOS[resolution] ?? EDGE_LENGTH_RATIO;
  return ratio * Math.sqrt(cellArea(resolution));
}

// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

const AUTHALIC_RADIUS = 6371007.2; // m
const AUTHALIC_AREA = 4 * Math.PI * AUTHALIC_RADIUS * AUTHALIC_RADIUS; // m^2

/**
 * Returns the number of cells at a given resolution.
 * 
 * @param resolution The resolution level
 * @returns Number of cells at the given resolution
 */
export function getNumCells(resolution: number): number {
  if (resolution < 0) return 0;
  if (resolution === 0) return 12;
  return 60 * Math.pow(4, resolution - 1);
}

/**
 * Returns the area of a cell at a given resolution in square kilometers.
 * 
 * @param resolution The resolution level
 * @returns Area of a cell in square meters
 */
export function cellArea(resolution: number): number {
  if (resolution < 0) return AUTHALIC_AREA;
  return AUTHALIC_AREA / getNumCells(resolution);
} 
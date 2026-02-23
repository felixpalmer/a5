// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

/**
 * Comparator for sorting bigint arrays.
 * Usage: `array.sort(compareBigint)`
 */
export function compareBigint(a: bigint, b: bigint): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

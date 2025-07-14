// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

/**
 * Returns resolution 0 cells of the A5 system, which serve as a starting point
 * for all higher-resolution subdivisions in the hierarchy.
 * 
 * @returns Array of 12 cell indices
 */
export function getRes0Cells(): bigint[] {
  const cells: bigint[] = [];
  const stamp = 0b10n << 56n; // Resolution 0 stamp
  
  // Generate 12 cells, one for each dodecahedron face
  for (let i = 0; i < 12; i++) {
    const segment = BigInt(i) << 58n; // 6 bits for segment, numbered incrementally
    const index = segment | stamp;
    cells.push(index);
  }
  
  return cells;
} 
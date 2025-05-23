// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type { LonLat } from '../core/coordinate-systems';
import { cellToBoundary } from '../core/cell';
import { cellToChildren, FIRST_HILBERT_RESOLUTION } from '../core/serialization';

// TODO find a nicer way to expose this
export function generateWireframe(resolution: number): LonLat[][] {
  let cells: LonLat[][] = [];
  let baseCells = 1;
  let stamp = 0n;
  if (resolution === 1) {
    baseCells = 12;
    stamp = 0b10n << 56n;
  } else {
    baseCells = 60;
    stamp = 0b01n << 56n;
  }

  for (let i = 0; i < baseCells; i++) {
    const segment = BigInt(i) << 58n; // 6 bits for segment, numbered incrementally
    const index = segment | stamp;
    if (resolution < FIRST_HILBERT_RESOLUTION) {
      cells.push(cellToBoundary(index));
    } else {
      const children = cellToChildren(index, resolution)
      cells = cells.concat(children.map(child => cellToBoundary(child)));
    }
  }
  return cells;
} 
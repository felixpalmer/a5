// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// Polygon fill by flooding the interior: cheaper than curve runs when the
// interior is small, as the flood costs about boundary + interior cells while
// the runs sort a band of boundary plus ring slots.

import type {Cartesian} from '../core/coordinate-systems';
import {toCartesian} from '../core/coordinate-transforms';
import {FIRST_HILBERT_RESOLUTION} from '../core/serialization';
import {getNumCells} from '../core/cell-info';
import {tripleSpaceFloodFill} from '../traversal/lattice-flood-fill';
import {forEachLatticeNeighbor, tripleCellCenter, tripleCellToId} from '../traversal/triple-cells';
import type {Boundary} from './polygon-boundary';
import {boundaryNeighbors, boundaryOutput, insideNextTo, polygonArea} from './polygon-boundary';

// Below this many estimated interior cells per boundary cell, flooding the
// interior beats splitting the curve into runs (measured crossover: ~3.3).
const FLOOD_INTERIOR_PER_BOUNDARY = 3;

/**
 * Whether to fill by flooding: the interior is small, and the polygon can't
 * swallow a quintant whole (`capHoldsQuintant` false), which the flood, never
 * crossing a quintant edge from the boundary, would miss.
 */
export function prefersFlood(
  ringVecsList: Cartesian[][],
  boundaryCount: number,
  resolution: number,
  capHoldsQuintant: boolean
): boolean {
  return (
    !capHoldsQuintant &&
    (polygonArea(ringVecsList) / (4 * Math.PI)) * getNumCells(resolution) < FLOOD_INTERIOR_PER_BOUNDARY * boundaryCount
  );
}

/**
 * Fill a polygon by flooding its interior, given its classified boundary and
 * the boundary cells as flat triples. Returns the cells inside, uncompacted and
 * unsorted.
 */
export function fillByFlood(boundary: Boundary, triples: number[], resolution: number, overlapping: boolean): bigint[] {
  const hilbertRes = resolution - FIRST_HILBERT_RESOLUTION + 1;
  const maxRow = (1 << hilbertRes) - 1;
  const out = boundaryOutput(boundary, overlapping);

  // The shell: the flood's own moves out of the boundary (each an edge
  // neighbor), split into seeds inside and firewall outside
  const {cells: shell, parents} = boundaryNeighbors(triples, [
    (b, c, visit) => forEachLatticeNeighbor(b[c], b[c + 1], b[c + 2], b[c + 3], b[c + 4], maxRow, visit)
  ]);
  const seeds: number[] = [];
  const firewall: number[] = triples.slice();
  for (let c = 0; c < shell.length; c += 5) {
    const s = shell;
    const center = toCartesian(tripleCellCenter(s[c], s[c + 1], s[c + 2], s[c + 3], s[c + 4], hilbertRes, maxRow));
    const side = insideNextTo(boundary, center, parents[c / 5]) ? seeds : firewall;
    for (let k = 0; k < 5; k++) side.push(s[c + k]);
  }
  if (seeds.length > 0) {
    for (let c = 0; c < seeds.length; c += 5) {
      out.push(
        tripleCellToId(seeds[c], seeds[c + 1], seeds[c + 2], seeds[c + 3], seeds[c + 4], hilbertRes, resolution)
      );
    }
    const {interiorCells} = tripleSpaceFloodFill(firewall, seeds, resolution);
    for (let i = 0; i < interiorCells.length; i++) out.push(interiorCells[i]);
  }
  return out;
}

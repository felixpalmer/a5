// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type { Orientation, Triple } from '../lattice';
import { sToAnchor, anchorToTriple, tripleToS, tripleInBounds, tripleParity } from '../lattice';
import type { Origin } from '../core/utils';
import { deserialize, serialize, FIRST_HILBERT_RESOLUTION } from '../core/serialization';
import { segmentToQuintant } from '../core/origin';
import { getGlobalCellNeighbors } from './global-neighbors';
import { type BoundaryContext, getBoundaryNeighbors } from './lattice-boundary';

/** Source-cell state used by the lattice neighbor finder. */
interface LatticeSource {
  origin: Origin;
  segment: number;
  S: bigint;
  resolution: number;
  hilbertRes: number;
  quintant: number;
  orientation: Orientation;
  triple: Triple;
  maxS: bigint;
  maxRow: number;
}

/** Deserialize and unpack into a LatticeSource. Returns null below FIRST_HILBERT_RESOLUTION. */
function decodeSource(cellId: bigint): LatticeSource | null {
  const {origin, segment, S, resolution} = deserialize(cellId);
  if (resolution < FIRST_HILBERT_RESOLUTION) return null;

  const hilbertRes = resolution - FIRST_HILBERT_RESOLUTION + 1;
  const {quintant, orientation} = segmentToQuintant(segment, origin);
  const anchor = sToAnchor(S, hilbertRes, orientation);
  const triple = anchorToTriple(anchor);

  return {
    origin, segment, S, resolution,
    hilbertRes, quintant, orientation, triple,
    maxS: 4n ** BigInt(hilbertRes),
    maxRow: (1 << hilbertRes) - 1,
  };
}

/** Build the BoundaryContext used by lattice-boundary helpers. */
function boundaryContext(src: LatticeSource): BoundaryContext {
  return {
    triple: src.triple,
    parity: tripleParity(src.triple),
    sourceQuintant: src.quintant,
    origin: src.origin,
    hilbertRes: src.hilbertRes,
    maxS: src.maxS,
    maxRow: src.maxRow,
    resolution: src.resolution,
  };
}

/**
 * Fast lattice-based neighbor finding for BFS in line tracing.
 *
 * Unlike `getGlobalCellNeighbors`, this skips `isNeighbor()` validation for
 * within-quintant candidates. The result is a SUPERSET of true neighbors —
 * it may include a few extra cells that share only a vertex point (not an edge).
 *
 * This is safe for BFS contexts where candidates are validated by
 * `cellIntersectsSegment` — false positives just fail that check.
 *
 * For res < 2, falls back to getGlobalCellNeighbors (rare).
 *
 * @param edgeOnly - If true, restrict to Manhattan distance ≤ 2 (edge-sharing candidates)
 */
export function getLatticeNeighbors(cellId: bigint, edgeOnly: boolean): bigint[] {
  const src = decodeSource(cellId);
  if (!src) return getGlobalCellNeighbors(cellId, {edgeOnly});

  const {origin, segment, S, resolution, hilbertRes, orientation, triple, maxS, maxRow} = src;
  const result: bigint[] = [];

  // Within-quintant: enumerate the 26-cube of ±1 deltas, skipping the source.
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dy === 0 && dz === 0) continue;
        const manhattan = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
        if (manhattan > 3) continue;
        if (edgeOnly && manhattan > 2) continue;

        const candidate: Triple = {x: triple.x + dx, y: triple.y + dy, z: triple.z + dz};
        if (!tripleInBounds(candidate, maxRow)) continue;

        const candidateS = tripleToS(candidate, hilbertRes, orientation);
        if (candidateS !== null && candidateS >= 0n && candidateS < maxS && candidateS !== S) {
          result.push(serialize({origin, segment, S: candidateS, resolution}));
        }
      }
    }
  }

  for (const c of getBoundaryNeighbors(boundaryContext(src), edgeOnly)) result.push(c);
  return result;
}

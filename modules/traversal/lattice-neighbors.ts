// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type {Orientation, Triple} from '../lattice';
import {sToTriple, tripleToS, tripleParity, tripleInBounds} from '../lattice';
import type {Origin} from '../core/utils';
import {deserialize, serialize, FIRST_HILBERT_RESOLUTION} from '../core/serialization';
import {segmentToQuintant} from '../core/origin';
import {getGlobalCellNeighbors} from './global-neighbors';
import {type BoundaryContext, getBoundaryNeighbors} from './lattice-boundary';

/** Decoded source-cell state used by the lattice neighbor finder. */
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
  const triple = sToTriple(S, hilbertRes, orientation);

  return {
    origin,
    segment,
    S,
    resolution,
    hilbertRes,
    quintant,
    orientation,
    triple,
    maxS: 4n ** BigInt(hilbertRes),
    maxRow: (1 << hilbertRes) - 1
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
    resolution: src.resolution
  };
}

type Delta = readonly [number, number, number];

/** The 3 parity-valid single-axis moves (strict triple-lattice edge connectivity). */
// prettier-ignore
const PARITY_EVEN_DELTAS: readonly Delta[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
// prettier-ignore
const PARITY_ODD_DELTAS: readonly Delta[] = [[-1, 0, 0], [0, -1, 0], [0, 0, -1]];

/**
 * Fast lattice-based neighbor finding over triple-space deltas: the 3
 * parity-valid moves — strict triple-lattice edge connectivity, the
 * connectivity `tripleSpaceFloodFill` uses. Falls back to
 * `getGlobalCellNeighbors` below res 2.
 */
export function getLatticeNeighbors(cellId: bigint): bigint[] {
  const src = decodeSource(cellId);
  if (!src) return getGlobalCellNeighbors(cellId, {edgeOnly: true});

  const {origin, segment, S, resolution, hilbertRes, orientation, triple, maxS, maxRow} = src;
  const deltas = tripleParity(triple) === 0 ? PARITY_EVEN_DELTAS : PARITY_ODD_DELTAS;
  const result: bigint[] = [];

  for (const [dx, dy, dz] of deltas) {
    const candidate: Triple = {x: triple.x + dx, y: triple.y + dy, z: triple.z + dz};
    if (!tripleInBounds(candidate, maxRow)) continue;
    const candidateS = tripleToS(candidate, hilbertRes, orientation);
    if (candidateS !== null && candidateS >= 0n && candidateS < maxS && candidateS !== S) {
      result.push(serialize({origin, segment, S: candidateS, resolution}));
    }
  }

  // Strict lattice connectivity doesn't traverse the [-maxRow, maxRow, 0] vertex
  // corner, so we skip it there too — keeping the firewall topology tight.
  for (const c of getBoundaryNeighbors(boundaryContext(src), true, true)) result.push(c);
  return result;
}

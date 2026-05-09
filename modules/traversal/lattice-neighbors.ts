// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type {Orientation, Triple} from '../lattice';
import {sToAnchor, anchorToTriple, tripleToS, tripleParity, tripleInBounds} from '../lattice';
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
  const anchor = sToAnchor(S, hilbertRes, orientation);
  const triple = anchorToTriple(anchor);

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

/** All 26 non-zero ±1 moves in 3D — vertex- and edge-sharing within-quintant candidates. */
const SUPERSET_DELTAS: readonly Delta[] = (() => {
  const out: Delta[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dy === 0 && dz === 0) continue;
        out.push([dx, dy, dz]);
      }
    }
  }
  return out;
})();

/** The 3 parity-valid single-axis moves matching `tripleSpaceFloodFill`'s edge connectivity. */
// prettier-ignore
const PARITY_EVEN_DELTAS: readonly Delta[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
// prettier-ignore
const PARITY_ODD_DELTAS: readonly Delta[] = [[-1, 0, 0], [0, -1, 0], [0, 0, -1]];

/**
 * Fast lattice-based neighbor finding. Skips `isNeighbor()` validation for
 * within-quintant candidates; falls back to `getGlobalCellNeighbors` below res 2.
 *
 * - `edgeOnly=false`: 26-cube ±1 superset (may include vertex-only touchers).
 *   For BFS that re-validates candidates downstream (e.g. line tracing).
 * - `edgeOnly=true`: 3 parity-valid moves matching `tripleSpaceFloodFill` —
 *   exact connectivity for shell-buffering the flood-fill firewall.
 */
export function getLatticeNeighbors(cellId: bigint, edgeOnly: boolean): bigint[] {
  const src = decodeSource(cellId);
  if (!src) return getGlobalCellNeighbors(cellId, {edgeOnly});

  const {origin, segment, S, resolution, hilbertRes, orientation, triple, maxS, maxRow} = src;
  const deltas = edgeOnly ? (tripleParity(triple) === 0 ? PARITY_EVEN_DELTAS : PARITY_ODD_DELTAS) : SUPERSET_DELTAS;
  const result: bigint[] = [];

  for (const [dx, dy, dz] of deltas) {
    const candidate: Triple = {x: triple.x + dx, y: triple.y + dy, z: triple.z + dz};
    if (!tripleInBounds(candidate, maxRow)) continue;
    const candidateS = tripleToS(candidate, hilbertRes, orientation);
    if (candidateS !== null && candidateS >= 0n && candidateS < maxS && candidateS !== S) {
      result.push(serialize({origin, segment, S: candidateS, resolution}));
    }
  }

  // Strict lattice connectivity (edgeOnly) doesn't traverse the [-maxRow, maxRow, 0]
  // vertex corner, so we skip it there too — keeping the firewall topology tight.
  for (const c of getBoundaryNeighbors(boundaryContext(src), edgeOnly, edgeOnly)) result.push(c);
  return result;
}

// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type { Orientation, Triple } from '../lattice';
import { sToAnchor, anchorToTriple, tripleToS, tripleParity, tripleInBounds } from '../lattice';
import type { Origin } from '../core/utils';
import { deserialize, serialize, FIRST_HILBERT_RESOLUTION } from '../core/serialization';
import { segmentToQuintant } from '../core/origin';
import { getGlobalCellNeighbors } from './global-neighbors';
import { type BoundaryContext, getBoundaryNeighbors } from './lattice-boundary';

/** Source-cell state shared by the two lattice neighbor finders. */
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
const PARITY_EVEN_DELTAS: readonly Delta[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
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
  const deltas = edgeOnly
    ? (tripleParity(triple) === 0 ? PARITY_EVEN_DELTAS : PARITY_ODD_DELTAS)
    : SUPERSET_DELTAS;
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

/** Per-quintant context needed to convert triples back to cell IDs. */
interface QuintantCtx {
  origin: Origin;
  segment: number;
  orientation: Orientation;
}

/** Per-quintant packed BFS state. Reusable across phases at the same resolution. */
export interface QuintantState {
  ctx: QuintantCtx;
  visited: Set<number>;
  frontier: number[];
}

/** Packed flood-fill state, indexed by quintant. */
export type PackedFloodState = Map<number, QuintantState>;

/**
 * Pack a triple as a single number key for fast Set lookup.
 * Encoding: (x + maxRow) * yStride + y * 2 + parity, where parity = (x+y+z) ∈ {0,1}.
 */
function packTripleKey(x: number, y: number, parity: number, maxRow: number, yStride: number): number {
  return (x + maxRow) * yStride + y * 2 + parity;
}

/** Inverse of packTripleKey — recover (x, y, z, parity) from a packed key. */
function unpackTripleKey(key: number, maxRow: number, yStride: number) {
  const parity = key % 2;
  const yPart = (key - parity) % yStride;
  const y = yPart / 2;
  const x = (key - yPart - parity) / yStride - maxRow;
  const z = parity - x - y;
  return {x, y, z, parity};
}

/** Convert a packed triple key back to a cell ID, or null if it doesn't map to a valid cell. */
function packedKeyToCellId(
  key: number, ctx: QuintantCtx, hilbertRes: number, maxRow: number,
  yStride: number, maxS: bigint, resolution: number,
): bigint | null {
  const {x, y, z} = unpackTripleKey(key, maxRow, yStride);
  const s = tripleToS({x, y, z}, hilbertRes, ctx.orientation);
  if (s === null || s < 0n || s >= maxS) return null;
  return serialize({origin: ctx.origin, segment: ctx.segment, S: s, resolution});
}

/** Convert a cell ID into its quintant context and packed triple key. */
function cellToQuintantKey(
  cellId: bigint, hilbertRes: number, maxRow: number, yStride: number,
): {quintantIdx: number, key: number, ctx: QuintantCtx} {
  const {origin, segment, S} = deserialize(cellId);
  const {orientation} = segmentToQuintant(segment, origin);
  const anchor = sToAnchor(S, hilbertRes, orientation);
  const triple = anchorToTriple(anchor);
  const parity = triple.x + triple.y + triple.z; // 0 or 1
  return {
    quintantIdx: origin.id * 60 + segment,
    key: packTripleKey(triple.x, triple.y, parity, maxRow, yStride),
    ctx: {origin, segment, orientation},
  };
}

/**
 * Triple-space flood fill in packed integer coordinates — no per-step bigint ops.
 * Uses the 3 parity-valid ±1 moves; since those never cross quintant boundaries,
 * each quintant is flooded independently.
 *
 * @param firewall    A bigint firewall set (mutated to include discoveries) or
 *                    a reused `{state, delta}` from a previous call (state
 *                    reused, only `delta` cells converted).
 * @param seedCellIds BFS seeds. Always added to the frontier, even if already
 *                    visited — reusing state with the same seeds restarts BFS.
 * @param maxLayers   Max BFS layers; undefined = run to convergence.
 */
export function tripleSpaceFloodFill(
  firewall: Set<bigint> | {state: PackedFloodState, delta: Iterable<bigint>},
  seedCellIds: bigint[],
  resolution: number,
  maxLayers?: number,
): {interiorCells: bigint[], frontierCellIds: bigint[], state: PackedFloodState} {
  const hilbertRes = resolution - FIRST_HILBERT_RESOLUTION + 1;
  const maxRow = (1 << hilbertRes) - 1;
  const yStride = (maxRow + 1) * 2;
  const maxS = 4n ** BigInt(hilbertRes);

  const reusing = !(firewall instanceof Set);
  let quintants: PackedFloodState;

  // Discovered cells per quintant for THIS call (excludes prior-call discoveries)
  const discoveredPerQ = new Map<number, number[]>();

  function getOrCreateQ(quintantIdx: number, ctx: QuintantCtx): QuintantState {
    let q = quintants.get(quintantIdx);
    if (!q) {
      q = {ctx, visited: new Set(), frontier: []};
      quintants.set(quintantIdx, q);
    }
    return q;
  }

  if (firewall instanceof Set) {
    quintants = new Map();
    for (const cellId of firewall) {
      const {quintantIdx, key, ctx} = cellToQuintantKey(cellId, hilbertRes, maxRow, yStride);
      getOrCreateQ(quintantIdx, ctx).visited.add(key);
    }
  } else {
    quintants = firewall.state;
    // Stale frontier from prior call — clear so seeds drive this BFS
    for (const [, q] of quintants) q.frontier = [];
    for (const cellId of firewall.delta) {
      const {quintantIdx, key, ctx} = cellToQuintantKey(cellId, hilbertRes, maxRow, yStride);
      getOrCreateQ(quintantIdx, ctx).visited.add(key);
    }
  }

  // Seed the frontier
  for (const cellId of seedCellIds) {
    const {quintantIdx, key, ctx} = cellToQuintantKey(cellId, hilbertRes, maxRow, yStride);
    const q = getOrCreateQ(quintantIdx, ctx);
    q.visited.add(key);
    q.frontier.push(key);
  }

  // 3 parity-valid moves and bounds checks inlined for the hot loop.
  let layers = 0;
  let hasWork = true;
  while (hasWork && (maxLayers === undefined || layers < maxLayers)) {
    hasWork = false;
    for (const [qIdx, q] of quintants) {
      if (q.frontier.length === 0) continue;
      let discovered = discoveredPerQ.get(qIdx);
      if (!discovered) { discovered = []; discoveredPerQ.set(qIdx, discovered); }
      const nextFrontier: number[] = [];
      for (const key of q.frontier) {
        const parity = key % 2;
        const yPart = ((key - parity) % yStride);
        const y = yPart / 2;
        const x = (key - yPart - parity) / yStride - maxRow;
        const step = parity === 0 ? 1 : -1;
        const newParity = 1 - parity;
        const yLimit = y - newParity;

        // Move in x: triple becomes (x+step, y, z); z = parity - x - y is unchanged
        const nx = x + step;
        const nz_x = parity - x - y;
        if (nx <= 0 && nz_x <= 0 && nx >= -yLimit && nz_x >= -yLimit) {
          const nk = (nx + maxRow) * yStride + y * 2 + newParity;
          if (!q.visited.has(nk)) {
            q.visited.add(nk);
            discovered.push(nk);
            nextFrontier.push(nk);
          }
        }

        // Move in y: triple becomes (x, y+step, z); z is unchanged
        const ny = y + step;
        const nz_y = parity - x - y;
        const nyLimit = ny - newParity;
        if (ny >= 0 && ny <= maxRow && nz_y <= 0 && x >= -nyLimit && nz_y >= -nyLimit) {
          const nk = (x + maxRow) * yStride + ny * 2 + newParity;
          if (!q.visited.has(nk)) {
            q.visited.add(nk);
            discovered.push(nk);
            nextFrontier.push(nk);
          }
        }

        // Move in z: triple becomes (x, y, z+step); the packed key shape (x, y, parity)
        // is identical to the x and y moves' starting point apart from parity flip.
        const z = parity - x - y;
        const nz = z + step;
        if (nz <= 0 && x >= -yLimit && nz >= -yLimit) {
          const nk = (x + maxRow) * yStride + y * 2 + newParity;
          if (!q.visited.has(nk)) {
            q.visited.add(nk);
            discovered.push(nk);
            nextFrontier.push(nk);
          }
        }
      }
      q.frontier = nextFrontier;
      if (nextFrontier.length > 0) hasWork = true;
    }
    layers++;
  }

  // Convert results back to cell IDs
  const interiorCells: bigint[] = [];
  const frontierCellIds: bigint[] = [];
  const bigintFirewall = !reusing ? (firewall as Set<bigint>) : null;

  for (const [qIdx, q] of quintants) {
    const discovered = discoveredPerQ.get(qIdx);
    if (discovered) {
      for (const key of discovered) {
        const cellId = packedKeyToCellId(key, q.ctx, hilbertRes, maxRow, yStride, maxS, resolution);
        if (cellId !== null) {
          interiorCells.push(cellId);
          if (bigintFirewall) bigintFirewall.add(cellId);
        }
      }
    }
    for (const key of q.frontier) {
      const cellId = packedKeyToCellId(key, q.ctx, hilbertRes, maxRow, yStride, maxS, resolution);
      if (cellId !== null) frontierCellIds.push(cellId);
    }
  }

  return {interiorCells, frontierCellIds, state: quintants};
}

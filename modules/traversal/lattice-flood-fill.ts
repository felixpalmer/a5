// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {tripleInBounds} from '../lattice';
import {FIRST_HILBERT_RESOLUTION} from '../core/serialization';
import {tripleCellKey, tripleCellToId} from './triple-cells';

/** Flood state, reusable across calls at one resolution: the keys of every cell visited so far. */
export interface FloodState {
  visited: Set<number>;
}

/**
 * Triple-space flood fill over the 3 parity-valid lattice moves. Those never
 * cross a quintant edge, so each quintant floods independently. All cells —
 * firewall, seeds, the returned frontier — are flat (originId, quintant, x, y,
 * z), so nothing is decoded; discovered cells are encoded once, on output.
 *
 * @param firewall    Cells the flood may not enter, or a reused `{state, delta}`
 *                    from a previous call (state reused, `delta` cells joining
 *                    its firewall).
 * @param seeds       BFS seeds. Always added to the frontier, even if already
 *                    visited — reusing state with the same seeds restarts BFS.
 * @param maxLayers   Max BFS layers; undefined = run to convergence.
 * @returns The cells discovered by this call (seeds excluded) and the final
 *          frontier, both as cell IDs (the frontier also in triple space), and
 *          the state for a follow-up call.
 */
export function tripleSpaceFloodFill(
  firewall: number[] | {state: FloodState; delta: number[]},
  seeds: number[],
  resolution: number,
  maxLayers?: number
): {interiorCells: bigint[]; frontierCellIds: bigint[]; frontier: number[]; state: FloodState} {
  const hilbertRes = resolution - FIRST_HILBERT_RESOLUTION + 1;
  const maxRow = (1 << hilbertRes) - 1;

  const state = Array.isArray(firewall) ? {visited: new Set<number>()} : firewall.state;
  const {visited} = state;
  const blocked = Array.isArray(firewall) ? firewall : firewall.delta;
  for (let c = 0; c < blocked.length; c += 5) {
    visited.add(tripleCellKey(blocked[c], blocked[c + 1], blocked[c + 2], blocked[c + 3], blocked[c + 4]));
  }
  for (let c = 0; c < seeds.length; c += 5) {
    visited.add(tripleCellKey(seeds[c], seeds[c + 1], seeds[c + 2], seeds[c + 3], seeds[c + 4]));
  }

  const discovered: number[] = [];
  let frontier: number[] = seeds;
  for (let layers = 0; frontier.length > 0 && (maxLayers === undefined || layers < maxLayers); layers++) {
    const next: number[] = [];
    const add = (originId: number, quintant: number, x: number, y: number, z: number) => {
      if (!tripleInBounds({x, y, z}, maxRow)) return;
      const key = tripleCellKey(originId, quintant, x, y, z);
      if (visited.has(key)) return;
      visited.add(key);
      discovered.push(originId, quintant, x, y, z);
      next.push(originId, quintant, x, y, z);
    };
    for (let c = 0; c < frontier.length; c += 5) {
      const originId = frontier[c];
      const quintant = frontier[c + 1];
      const x = frontier[c + 2];
      const y = frontier[c + 3];
      const z = frontier[c + 4];
      // +1 on one axis from a parity 0 triple, -1 from parity 1
      const step = x + y + z === 0 ? 1 : -1;
      add(originId, quintant, x + step, y, z);
      add(originId, quintant, x, y + step, z);
      add(originId, quintant, x, y, z + step);
    }
    frontier = next;
  }

  const toIds = (cells: number[]): bigint[] => {
    const ids: bigint[] = [];
    for (let c = 0; c < cells.length; c += 5) {
      ids.push(
        tripleCellToId(cells[c], cells[c + 1], cells[c + 2], cells[c + 3], cells[c + 4], hilbertRes, resolution)
      );
    }
    return ids;
  };
  return {interiorCells: toIds(discovered), frontierCellIds: toIds(frontier), frontier, state};
}

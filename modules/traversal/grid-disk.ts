// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { getGlobalCellNeighbors } from './global-neighbors';
import { compact } from '../core/compact';

/**
 * BFS grid disk with progressive compaction.
 *
 * Uses a sliding-window dedup approach: only the previous and current frontier
 * rings are kept in memory for deduplication (BFS guarantees cells ≥2 rings
 * behind the frontier can never be re-discovered). Evicted interior cells are
 * periodically compacted to reduce memory pressure.
 */
function _gridDiskBFS(cellId: bigint, k: number, edgeOnly: boolean): BigUint64Array {
  if (k === 0) {
    return new BigUint64Array([cellId]);
  }

  let interior: bigint[] = [];
  let prevFrontier = new Set<bigint>();
  let frontier = new Set<bigint>([cellId]);
  const neighborOpts = edgeOnly ? {edgeOnly: true as const} : undefined;

  for (let ring = 1; ring <= k; ring++) {
    const nextFrontier = new Set<bigint>();
    for (const id of frontier) {
      for (const neighbor of getGlobalCellNeighbors(id, neighborOpts)) {
        if (!prevFrontier.has(neighbor) && !frontier.has(neighbor) && !nextFrontier.has(neighbor)) {
          nextFrontier.add(neighbor);
        }
      }
    }

    // Evict prevFrontier — these cells are ≥2 rings behind the new frontier
    // and can never be re-discovered by BFS
    for (const id of prevFrontier) {
      interior.push(id);
    }

    // Progressively compact interior to reduce memory pressure
    if (interior.length > 100) {
      interior = Array.from(compact(interior));
    }

    prevFrontier = frontier;
    frontier = nextFrontier;
  }

  // Merge remaining boundary rings with compacted interior
  for (const id of prevFrontier) interior.push(id);
  for (const id of frontier) interior.push(id);

  return compact(interior);
}

/**
 * Compute the grid disk of edge-sharing neighbors within k hops.
 * Returns a sorted, compacted BigUint64Array of cell IDs including
 * the center cell.
 *
 * This matches H3's `gridDisk` semantics — only edge-sharing neighbors are
 * followed. For A5 pentagons, each cell has exactly 5 edge neighbors.
 *
 * To get all cells at the input resolution, chain with `uncompact`:
 * ```ts
 * const flat = uncompact(gridDisk(cellId, k), getResolution(cellId));
 * ```
 *
 * @param cellId - Center cell ID (bigint)
 * @param k - Number of hops (must be >= 0)
 * @returns Sorted BigUint64Array of compacted cell IDs in the disk
 */
export function gridDisk(cellId: bigint, k: number): BigUint64Array {
  return _gridDiskBFS(cellId, k, true);
}

/**
 * Compute the grid disk of all neighbors (edge + vertex sharing) within k hops.
 * Returns a sorted, compacted BigUint64Array of cell IDs including
 * the center cell.
 *
 * This is an A5 extension — pentagons have both edge-sharing (5) and
 * vertex-only-sharing neighbors (1-3), giving 6-8 total neighbors per cell.
 *
 * To get all cells at the input resolution, chain with `uncompact`:
 * ```ts
 * const flat = uncompact(gridDiskVertex(cellId, k), getResolution(cellId));
 * ```
 *
 * @param cellId - Center cell ID (bigint)
 * @param k - Number of hops (must be >= 0)
 * @returns Sorted BigUint64Array of compacted cell IDs in the disk
 */
export function gridDiskVertex(cellId: bigint, k: number): BigUint64Array {
  return _gridDiskBFS(cellId, k, false);
}

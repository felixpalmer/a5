// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {compactCells, toCovering} from '../coverings/slot-runs';
import {deserialize, serialize, FIRST_HILBERT_RESOLUTION} from '../core/serialization';
import {origins} from '../core/origin';
import {walkFaces} from '../core/face-adjacency';
import type {TripleCellVisitor} from './triple-cells';
import {cellIdsToTriples, forEachTripleNeighbor, tripleCellKey, tripleCellToId} from './triple-cells';

/** One BFS ring: its dedup keys, and its cells as flat (originId, quintant, x, y, z). */
interface Ring {
  keys: Set<number>;
  cells: number[];
}

/** Add a cell to `next` unless it is already in one of the three live rings. */
function addCell(
  next: Ring,
  prev: Ring,
  current: Ring,
  originId: number,
  quintant: number,
  x: number,
  y: number,
  z: number
): void {
  const key = tripleCellKey(originId, quintant, x, y, z);
  if (prev.keys.has(key) || current.keys.has(key) || next.keys.has(key)) return;
  next.keys.add(key);
  next.cells.push(originId, quintant, x, y, z);
}

/** Encode a ring's cells as cell IDs, appending them to `out`. */
function pushCellIds(out: bigint[], cells: number[], hilbertRes: number, resolution: number): void {
  for (let c = 0; c < cells.length; c += 5) {
    out.push(tripleCellToId(cells[c], cells[c + 1], cells[c + 2], cells[c + 3], cells[c + 4], hilbertRes, resolution));
  }
}

/**
 * BFS grid disk in triple space, with progressive compaction.
 *
 * Neighbors come from the per-flavor triple deltas, plus the boundary delta
 * tables for cells on a quintant edge, so no cell is decoded and each is
 * encoded exactly once, when it leaves the window.
 *
 * Uses a sliding-window dedup approach: only the previous and current frontier
 * rings are kept in memory for deduplication (BFS guarantees cells ≥2 rings
 * behind the frontier can never be re-discovered). Evicted interior cells are
 * periodically compacted to reduce memory pressure.
 */
function _gridDisk(cellId: bigint, k: number, edgeOnly: boolean): BigUint64Array {
  const {origin, resolution} = deserialize(cellId);
  if (k === 0) return toCovering([cellId], resolution);
  if (resolution === 0) {
    // The cells are the 12 dodecahedron faces
    const faces = walkFaces([origin.id], () => true, k);
    return toCovering(
      faces.map(face => serialize({origin: origins[face], segment: 0, S: 0n, resolution: 0})),
      0
    );
  }
  const hilbertRes = resolution - FIRST_HILBERT_RESOLUTION + 1;
  const maxRow = (1 << hilbertRes) - 1;
  const [originId, quintant, x, y, z] = cellIdsToTriples([cellId]);

  // The seed is `cellId` already, so it goes straight to the output
  let interior: bigint[] = [cellId];
  let prevFrontier: Ring = {keys: new Set(), cells: []};
  let frontier: Ring = {keys: new Set(), cells: []};
  addCell(frontier, prevFrontier, prevFrontier, originId, quintant, x, y, z);

  for (let ring = 1; ring <= k; ring++) {
    const nextFrontier: Ring = {keys: new Set(), cells: []};
    const visit: TripleCellVisitor = (originId, q, x, y, z) =>
      addCell(nextFrontier, prevFrontier, frontier, originId, q, x, y, z);
    const cells = frontier.cells;
    for (let c = 0; c < cells.length; c += 5) {
      forEachTripleNeighbor(cells[c], cells[c + 1], cells[c + 2], cells[c + 3], cells[c + 4], maxRow, edgeOnly, visit);
    }

    // The seed ring is expanded; drop its cell so it isn't encoded again (its key stays)
    if (ring === 1) frontier.cells.length = 0;

    // Evict prevFrontier — these cells are ≥2 rings behind the new frontier
    // and can never be re-discovered by BFS
    pushCellIds(interior, prevFrontier.cells, hilbertRes, resolution);

    // Progressively compact interior to reduce memory pressure
    if (interior.length > 100) {
      interior = compactCells(interior);
    }

    prevFrontier = frontier;
    frontier = nextFrontier;
  }

  // Merge remaining boundary rings with compacted interior
  pushCellIds(interior, prevFrontier.cells, hilbertRes, resolution);
  pushCellIds(interior, frontier.cells, hilbertRes, resolution);

  return toCovering(interior, resolution);
}

/**
 * Compute the grid disk of edge-sharing neighbors within k hops.
 * Returns compacted cell IDs including the center cell, sorted in curve
 * order, then a compaction marker recording the resolution.
 *
 * To get all cells at the input resolution, chain with `uncompact`:
 * ```ts
 * const flat = uncompact(gridDisk(cellId, k));
 * ```
 *
 * @param cellId - Center cell ID (bigint)
 * @param k - Number of hops (must be >= 0)
 * @returns Compacted cells in the disk, sorted in curve order, then the compaction marker
 */
export function gridDisk(cellId: bigint, k: number): BigUint64Array {
  return _gridDisk(cellId, k, true);
}

/**
 * Compute the grid disk of all neighbors (edge + vertex sharing) within k hops.
 * Returns compacted cell IDs including the center cell, sorted in curve
 * order, then a compaction marker recording the resolution.
 *
 * To get all cells at the input resolution, chain with `uncompact`:
 * ```ts
 * const flat = uncompact(gridDiskVertex(cellId, k));
 * ```
 *
 * @param cellId - Center cell ID (bigint)
 * @param k - Number of hops (must be >= 0)
 * @returns Compacted cells in the disk, sorted in curve order, then the compaction marker
 */
export function gridDiskVertex(cellId: bigint, k: number): BigUint64Array {
  return _gridDisk(cellId, k, false);
}

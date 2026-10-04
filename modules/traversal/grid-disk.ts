// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type {Orientation, Triple} from '../lattice';
import {sToTriple, tripleFlavor, tripleInBounds, tripleToS} from '../lattice';
import {getBoundaryNeighborTriples} from './lattice-boundary';
import {NEIGHBOR_DELTAS} from './neighbors';
import {compact} from '../core/compact';
import {deserialize, serialize, FIRST_HILBERT_RESOLUTION} from '../core/serialization';
import {origins, quintantToSegment, segmentToQuintant} from '../core/origin';
import {FACE_ADJACENCY} from '../core/face-adjacency';

// Cells are deduplicated by one integer key: the quintant (origin.id * 5 +
// quintant, < 60), parity, and the low KEY_BITS bits of -x and -z (y follows).
// That fits in 51 bits, exact as a JS number. Up to Hilbert resolution 21 the
// coordinates fit whole; above it, two cells of one quintant share a key only
// if they are 2^22 rows apart, and a disk holding both would need k ≈ 2^21
// (~10^12 cells) — far past what fits in memory. Keys are only built, never
// decoded (division and modulo on doubles are slow).
const KEY_BITS = 22;
const KEY_MASK = (1 << KEY_BITS) - 1;
const KEY_SIDE = 2 ** KEY_BITS;

// Segment and curve orientation of each of the 60 quintants, by origin.id * 5 +
// quintant. Filled on first use: calling quintantToSegment at module load
// leaves V8 type feedback that slows serialize everywhere (uncompact 2x).
const QUINTANT_SEGMENT: number[] = [];
const QUINTANT_ORIENTATION: Orientation[] = [];
function fillQuintantSegments(): void {
  for (const origin of origins) {
    for (let q = 0; q < 5; q++) {
      const {segment, orientation} = quintantToSegment(q, origin);
      QUINTANT_SEGMENT.push(segment);
      QUINTANT_ORIENTATION.push(orientation);
    }
  }
}

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
  const key =
    (((0 - x) & KEY_MASK) * KEY_SIDE + ((0 - z) & KEY_MASK)) * 2 +
    x +
    y +
    z +
    (originId * 5 + quintant) * 2 * KEY_SIDE * KEY_SIDE;
  if (prev.keys.has(key) || current.keys.has(key) || next.keys.has(key)) return;
  next.keys.add(key);
  next.cells.push(originId, quintant, x, y, z);
}

/** Encode a ring's cells as cell IDs, appending them to `out`. */
function pushCellIds(out: bigint[], cells: number[], hilbertRes: number, resolution: number): void {
  for (let c = 0; c < cells.length; c += 5) {
    const q = cells[c] * 5 + cells[c + 1];
    const s = tripleToS({x: cells[c + 2], y: cells[c + 3], z: cells[c + 4]}, hilbertRes, QUINTANT_ORIENTATION[q])!;
    out.push(serialize({origin: origins[cells[c]], segment: QUINTANT_SEGMENT[q], S: s, resolution}));
  }
}

/** Resolution 0: the cells are the 12 dodecahedron faces, adjacent across their edges. */
function _gridDiskFaces(originId: number, k: number): BigUint64Array {
  const disk = new Set<number>([originId]);
  for (let ring = 0; ring < k && disk.size < 12; ring++) {
    for (const id of [...disk]) {
      for (let q = 0; q < 5; q++) disk.add(FACE_ADJACENCY[id][q][0]);
    }
  }
  const cells: bigint[] = [];
  for (const id of disk) cells.push(serialize({origin: origins[id], segment: 0, S: 0n, resolution: 0}));
  return compact(cells);
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
  if (k === 0) return new BigUint64Array([cellId]);
  const {origin, segment, S, resolution} = deserialize(cellId);
  if (resolution === 0) return _gridDiskFaces(origin.id, k);
  if (QUINTANT_SEGMENT.length === 0) fillQuintantSegments();
  const hilbertRes = resolution - FIRST_HILBERT_RESOLUTION + 1;
  const maxRow = (1 << hilbertRes) - 1;
  const {quintant, orientation} = segmentToQuintant(segment, origin);
  const seed = sToTriple(S, hilbertRes, orientation);

  // The seed is `cellId` already, so it goes straight to the output
  let interior: bigint[] = [cellId];
  let prevFrontier: Ring = {keys: new Set(), cells: []};
  let frontier: Ring = {keys: new Set(), cells: []};
  addCell(frontier, prevFrontier, prevFrontier, origin.id, quintant, seed.x, seed.y, seed.z);
  const boundary: number[] = [];

  for (let ring = 1; ring <= k; ring++) {
    const nextFrontier: Ring = {keys: new Set(), cells: []};
    const cells = frontier.cells;
    for (let c = 0; c < cells.length; c += 5) {
      const originId = cells[c];
      const q = cells[c + 1];
      const x = cells[c + 2];
      const y = cells[c + 3];
      const z = cells[c + 4];
      const triple: Triple = {x, y, z};

      // Within the quintant: the fixed per-flavor deltas
      const flavor = tripleFlavor(triple, maxRow);
      const deltas = edgeOnly ? NEIGHBOR_DELTAS[flavor].edge : NEIGHBOR_DELTAS[flavor].all;
      for (let i = 0; i < deltas.length; i++) {
        const d = deltas[i];
        const neighbor = {x: x + d.x, y: y + d.y, z: z + d.z};
        if (!tripleInBounds(neighbor, maxRow)) continue;
        addCell(nextFrontier, prevFrontier, frontier, originId, q, neighbor.x, neighbor.y, neighbor.z);
      }

      // Across a quintant edge: the boundary delta tables
      if (x === 0 || z === 0 || y === maxRow) {
        boundary.length = 0;
        const ctx = {triple, parity: x + y + z, sourceQuintant: q, origin: origins[originId], maxRow};
        getBoundaryNeighborTriples(ctx, edgeOnly, false, boundary);
        for (let i = 0; i < boundary.length; i += 5) {
          const b = boundary;
          addCell(nextFrontier, prevFrontier, frontier, b[i], b[i + 1], b[i + 2], b[i + 3], b[i + 4]);
        }
      }
    }

    // The seed ring is expanded; drop its cell so it isn't encoded again (its key stays)
    if (ring === 1) frontier.cells.length = 0;

    // Evict prevFrontier — these cells are ≥2 rings behind the new frontier
    // and can never be re-discovered by BFS
    pushCellIds(interior, prevFrontier.cells, hilbertRes, resolution);

    // Progressively compact interior to reduce memory pressure
    if (interior.length > 100) {
      interior = Array.from(compact(interior));
    }

    prevFrontier = frontier;
    frontier = nextFrontier;
  }

  // Merge remaining boundary rings with compacted interior
  pushCellIds(interior, prevFrontier.cells, hilbertRes, resolution);
  pushCellIds(interior, frontier.cells, hilbertRes, resolution);

  return compact(interior);
}

/**
 * Compute the grid disk of edge-sharing neighbors within k hops.
 * Returns a sorted, compacted BigUint64Array of cell IDs including
 * the center cell.
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
  return _gridDisk(cellId, k, true);
}

/**
 * Compute the grid disk of all neighbors (edge + vertex sharing) within k hops.
 * Returns a sorted, compacted BigUint64Array of cell IDs including
 * the center cell.
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
  return _gridDisk(cellId, k, false);
}

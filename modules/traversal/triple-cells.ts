// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// Cells handled in triple space — (originId, quintant, x, y, z) — by the
// traversal algorithms that walk many neighboring cells: they key and dedup
// cells as plain integers and encode a cell to its ID only when it is output.

import type {Face, Spherical} from '../core/coordinate-systems';
import type {OriginId} from '../core/utils';
import type {Orientation, Triple} from '../lattice';
import {sToTriple, tripleFlavor, tripleInBounds, tripleToS} from '../lattice';
import {deserialize, serialize, FIRST_HILBERT_RESOLUTION} from '../core/serialization';
import {origins, quintantToSegment, segmentToQuintant} from '../core/origin';
import {getPentagonCenter} from '../core/tiling';
import {DodecahedronProjection} from '../projections/dodecahedron';
import {getBoundaryNeighborTriples} from './lattice-boundary';
import {NEIGHBOR_DELTAS} from './neighbors';

const dodecahedron = new DodecahedronProjection();

// A cell's key packs the quintant (origin.id * 5 + quintant, < 60), parity,
// and the low KEY_BITS bits of -x and -z (y follows) into 51 bits, exact as a
// JS number. Up to Hilbert resolution 21 the coordinates fit whole; above it,
// two cells of one quintant share a key only if they are 2^22 rows apart, and a
// walk holding both would need ~2^21 steps (~10^12 cells for a disk) — far past
// what fits in memory. Keys are only built, never decoded (division and modulo
// on doubles are slow).
const KEY_BITS = 22;
const KEY_MASK = (1 << KEY_BITS) - 1;
const KEY_SIDE = 2 ** KEY_BITS;

/** The integer key of a cell, unique among the cells of any one traversal. */
export function tripleCellKey(originId: number, quintant: number, x: number, y: number, z: number): number {
  return (
    (((0 - x) & KEY_MASK) * KEY_SIDE + ((0 - z) & KEY_MASK)) * 2 +
    x +
    y +
    z +
    (originId * 5 + quintant) * 2 * KEY_SIDE * KEY_SIDE
  );
}

// Segment and curve orientation of each of the 60 quintants, by origin.id * 5 +
// quintant. Filled on first use: calling quintantToSegment at module load
// leaves V8 type feedback that slows serialize everywhere (uncompact 2x).
const QUINTANT_SEGMENT: number[] = [];
const QUINTANT_ORIENTATION: Orientation[] = [];

/** The cell ID of a cell given in triple space. */
export function tripleCellToId(
  originId: number,
  quintant: number,
  x: number,
  y: number,
  z: number,
  hilbertRes: number,
  resolution: number
): bigint {
  if (QUINTANT_SEGMENT.length === 0) {
    for (const origin of origins) {
      for (let q = 0; q < 5; q++) {
        const {segment, orientation} = quintantToSegment(q, origin);
        QUINTANT_SEGMENT.push(segment);
        QUINTANT_ORIENTATION.push(orientation);
      }
    }
  }
  const q = originId * 5 + quintant;
  const s = tripleToS({x, y, z}, hilbertRes, QUINTANT_ORIENTATION[q])!;
  return serialize({origin: origins[originId], segment: QUINTANT_SEGMENT[q], S: s, resolution});
}

/**
 * Decode cell IDs (each at resolution 1 or above) into triple space, appending
 * them to `out` as flat (originId, quintant, x, y, z).
 */
export function cellIdsToTriples(cellIds: Iterable<bigint>, out: number[] = []): number[] {
  for (const cellId of cellIds) {
    const {origin, segment, S, resolution} = deserialize(cellId);
    const {quintant, orientation} = segmentToQuintant(segment, origin);
    const t = sToTriple(S, resolution - FIRST_HILBERT_RESOLUTION + 1, orientation);
    out.push(origin.id, quintant, t.x, t.y, t.z);
  }
  return out;
}

/** The center of a cell given in triple space, on the sphere. */
export function tripleCellCenter(
  originId: number,
  quintant: number,
  x: number,
  y: number,
  z: number,
  hilbertRes: number,
  maxRow: number
): Spherical {
  const triple = {x, y, z};
  const face = getPentagonCenter(hilbertRes, quintant, triple, tripleFlavor(triple, maxRow));
  return dodecahedron.inverse(face as Face, originId as OriginId);
}

/** Receives a cell given in triple space. */
export type TripleCellVisitor = (originId: number, quintant: number, x: number, y: number, z: number) => void;

// Scratch for the boundary neighbors of one cell (visitors never re-enter)
const boundary: number[] = [];

/**
 * Visit every neighbor of a cell given in triple space: within its quintant the
 * fixed per-flavor triple deltas, and, for a cell on a quintant edge (x = 0,
 * z = 0 or y = maxRow), the boundary delta tables. `edgeOnly` restricts to the
 * 5 edge-sharing neighbors; otherwise the vertex-only neighbors come too. A
 * neighbor may be visited more than once; visitors deduplicate.
 */
export function forEachTripleNeighbor(
  originId: number,
  quintant: number,
  x: number,
  y: number,
  z: number,
  maxRow: number,
  edgeOnly: boolean,
  visit: TripleCellVisitor
): void {
  const triple: Triple = {x, y, z};

  // Within the quintant: the fixed per-flavor deltas
  const flavor = tripleFlavor(triple, maxRow);
  const deltas = edgeOnly ? NEIGHBOR_DELTAS[flavor].edge : NEIGHBOR_DELTAS[flavor].all;
  for (let i = 0; i < deltas.length; i++) {
    const d = deltas[i];
    const neighbor = {x: x + d.x, y: y + d.y, z: z + d.z};
    if (tripleInBounds(neighbor, maxRow)) visit(originId, quintant, neighbor.x, neighbor.y, neighbor.z);
  }

  // Across a quintant edge: the boundary delta tables
  if (x === 0 || z === 0 || y === maxRow) visitBoundary(originId, quintant, triple, maxRow, edgeOnly, false, visit);
}

/**
 * Visit every lattice neighbor of a cell given in triple space: the 3
 * parity-valid single-axis moves within its quintant (the connectivity
 * `tripleSpaceFloodFill` floods by), and, for a cell on a quintant edge, its
 * edge-sharing boundary neighbors — but not the vertex corner, which the
 * lattice moves don't traverse either. A neighbor may be visited more than
 * once; visitors deduplicate.
 */
export function forEachLatticeNeighbor(
  originId: number,
  quintant: number,
  x: number,
  y: number,
  z: number,
  maxRow: number,
  visit: TripleCellVisitor
): void {
  // Within the quintant: +1 on one axis from a parity 0 triple, -1 from parity 1
  const step = x + y + z === 0 ? 1 : -1;
  if (tripleInBounds({x: x + step, y, z}, maxRow)) visit(originId, quintant, x + step, y, z);
  if (tripleInBounds({x, y: y + step, z}, maxRow)) visit(originId, quintant, x, y + step, z);
  if (tripleInBounds({x, y, z: z + step}, maxRow)) visit(originId, quintant, x, y, z + step);

  // Across a quintant edge: the boundary delta tables
  if (x === 0 || z === 0 || y === maxRow) visitBoundary(originId, quintant, {x, y, z}, maxRow, true, true, visit);
}

/** Visit the neighbors of a cell on a quintant edge that lie across it. */
function visitBoundary(
  originId: number,
  quintant: number,
  triple: Triple,
  maxRow: number,
  edgeOnly: boolean,
  skipCorners: boolean,
  visit: TripleCellVisitor
): void {
  boundary.length = 0;
  const ctx = {
    triple,
    parity: triple.x + triple.y + triple.z,
    sourceQuintant: quintant,
    origin: origins[originId],
    maxRow
  };
  getBoundaryNeighborTriples(ctx, edgeOnly, skipCorners, boundary);
  for (let i = 0; i < boundary.length; i += 5) {
    visit(boundary[i], boundary[i + 1], boundary[i + 2], boundary[i + 3], boundary[i + 4]);
  }
}

// The cell hierarchy in triple space. A cell's 4 children are 2·triple + the
// offsets for its flavor (each level of A5 refines the square grid R of
// g o^r D into 4); only their curve order depends on the orientation.
// prettier-ignore
const CHILD_OFFSETS: readonly number[][] = [
  [0, 0, 0, 0, 1, -1, 0, 1, 0, 0, 2, -1], // flavor 0
  [-1, -1, 0, -1, 0, -1, -1, 0, 0, -1, 1, -1], // flavor 1
  [-1, 1, 0, 0, 0, 0, 0, 1, -1, 0, 1, 0], // flavor 2
  [-1, 0, -1, -1, 0, 0, -1, 1, -1, 0, 0, -1] // flavor 3
];

/** The 4 children of a cell given in triple space (`maxRow` is its own), appended to `out`. */
export function tripleChildren(
  originId: number,
  quintant: number,
  x: number,
  y: number,
  z: number,
  maxRow: number,
  out: number[]
): void {
  const d = CHILD_OFFSETS[tripleFlavor({x, y, z}, maxRow)];
  for (let i = 0; i < 12; i += 3) out.push(originId, quintant, 2 * x + d[i], 2 * y + d[i + 1], 2 * z + d[i + 2]);
}

/**
 * The parent of a cell given in triple space (`parentMaxRow` is the parent's),
 * appended to `out`. The child's coordinates mod 2 fix child - 2·parent, but
 * for two classes, where the two candidate parents differ in flavor — and so,
 * sharing x and z, in apex colour (see tripleFlavor).
 */
export function tripleParent(
  originId: number,
  quintant: number,
  x: number,
  y: number,
  z: number,
  parentMaxRow: number,
  out: number[]
): void {
  const dx = -(x & 1);
  const dz = -(z & 1);
  let dy = y & 1;
  // The offsets are even-sized steps, so >> 1 halves exactly (and keeps small integers)
  const px = (x - dx) >> 1;
  const pz = (z - dz) >> 1;
  const colour = (parentMaxRow + 1 + px + pz) & 1;
  if (dx === 0 && dy === 0 && dz === -1) dy = colour === 0 ? 2 : 0; // flavor 0 or 3 parent
  if (dx === -1 && dy === 1 && dz === 0) dy = colour === 1 ? 1 : -1; // flavor 2 or 1 parent
  out.push(originId, quintant, px, (y - dy) >> 1, pz);
}

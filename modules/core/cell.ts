// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {mat2, vec2, vec3, glMatrix} from 'gl-matrix';
glMatrix.setMatrixArrayType(Float64Array as any);

import type {Cartesian, Face, LonLat, Spherical} from './coordinate-systems';
import {FaceToIJ, fromLonLat, toLonLat, toPolar, normalizeLongitudes} from './coordinate-transforms';
import {
  findNearestOrigin,
  findNearestOrigins,
  QUINTANT_TO_ORIENTATION,
  QUINTANT_TO_SEGMENT,
  SEGMENT_TO_ORIENTATION,
  SEGMENT_TO_QUINTANT
} from './origin';
import {DodecahedronProjection} from '../projections/dodecahedron';
import {A5Cell, Origin, OriginId} from './utils';
import {PentagonShape} from '../geometry/pentagon';
import {cellMarginScaled, getFaceVertices, getPentagonCenter, getPentagonVertices, getQuintantPolar, getQuintantVertices} from './tiling';
import {PI_OVER_5} from './constants';
import {roundToTriple, sToCell, tripleFlavor, tripleInBounds, tripleToS} from '../lattice';
import type {Triple} from '../lattice';
import {deserialize, serialize, FIRST_HILBERT_RESOLUTION, MAX_RESOLUTION, WORLD_CELL} from './serialization';
import {NEIGHBOR_DELTAS} from '../traversal/neighbors';

// Reuse these objects to avoid allocation
const rotation = mat2.create();
const dodecahedron = new DodecahedronProjection();

// Single-entry cache of the most recent successful lookup. Speeds up
// dense-sample workloads (polygon boundary tracing, line tracing) where
// consecutive calls often land in the same cell. The cache stores the
// pre-computed pentagon + origin so the hit-test is just one projection
// + one pentagon containment check.
let _lastResult: {
  cellId: bigint;
  pentagon: PentagonShape;
  originId: OriginId;
  resolution: number;
} | null = null;

export function lonLatToCell(lonLat: LonLat, resolution: number): bigint {
  return sphericalToCell(fromLonLat(lonLat), resolution);
}


/**
 * Like `lonLatToCell`, but accepts a point already in A5's internal spherical
 * representation (rotated authalic frame, as produced by `fromLonLat` or
 * `toSpherical(authalicCartesian)`). Skips the redundant authalic
 * inverse/forward round-trip in dense-sample loops where the input already
 * comes from the authalic Cartesian space (e.g. polygon-fill boundary slerp).
 */
// Scratch for the fast path's scaled quintant-frame point
const _scaledPoint = vec2.create();

export function sphericalToCell(spherical: Spherical, resolution: number): bigint {
  // Resolution -1 represents WORLD_CELL, which covers the entire world
  if (resolution === -1) {
    return WORLD_CELL;
  }

  if (resolution < FIRST_HILBERT_RESOLUTION) {
    // For low resolutions there is no Hilbert curve: the cell is determined by
    // the face (and quintant) alone, so the lookup is exact.
    const origin = findNearestOrigin(spherical);
    const dodecPoint = dodecahedron.forward(spherical, origin.id);
    const quintant = getQuintantPolar(toPolar(dodecPoint));
    const segment = QUINTANT_TO_SEGMENT[origin.id * 5 + quintant];
    return serialize({S: 0n, segment, origin, resolution});
  }

  // Try the cached pentagon first — skips the full lookup when consecutive
  // calls land in the same cell (common in dense-sample loops).
  if (_lastResult && _lastResult.resolution === resolution) {
    const projected = dodecahedron.forward(spherical, _lastResult.originId);
    if (_lastResult.pentagon.containsPoint(projected as Face) > 0) return _lastResult.cellId;
  }

  // Fast path: locate the containing pentagon directly. Round to the leaf
  // triangle, get the closed-form flavor, and test the pentagon geometrically
  // in the scaled quintant frame; the triangular and pentagonal lattices are
  // not congruent, but the containing pentagon is always the triangle's cell
  // or one of its fixed neighbor deltas (verified exhaustively), so at most
  // one 7-candidate walk resolves it — then a single curve encode.
  const origin = findNearestOrigin(spherical);
  const dodecPoint = dodecahedron.forward(spherical, origin.id);
  const quintant = getQuintantPolar(toPolar(dodecPoint));
  const best = _lookupInQuintant(dodecPoint, origin, quintant, resolution);
  if (best !== null && best.margin > 0) return _acceptCandidate(best);
  // No strictly-containing pentagon in the assigned frame: the point sits on a
  // cell boundary or within float noise of a quintant/face seam.
  return _sphericalToCellBoundary(spherical, resolution, origin, quintant, best);
}

// The best cell for `dodecPoint` (face frame of `origin`) within one quintant:
// round to the leaf triangle, closed-form flavor, geometric margin, and — when
// the triangle's cell doesn't strictly contain the point — the best of its
// fixed neighbor deltas. margin > 0 ⇔ the unique strictly-containing pentagon.
interface CellCandidate {
  margin: number;
  cellId: bigint;
  triple: Triple;
  flavor: number;
  quintant: number;
  hilbertResolution: number;
  originId: OriginId;
  resolution: number;
}

function _lookupInQuintant(
  dodecPoint: Face,
  origin: Origin,
  quintant: number,
  resolution: number
): CellCandidate | null {
  const globalQuintant = origin.id * 5 + quintant;
  const segment = QUINTANT_TO_SEGMENT[globalQuintant];
  const orientation = QUINTANT_TO_ORIENTATION[globalQuintant];

  // Res-30 ids can only encode quintants 0-41 (by design: 64 bits cannot fit
  // res 30 globally, so A5 covers the populous region). In the unsupported
  // quintants, answer at the finest representable resolution instead — the
  // res-29 cell CONTAINING the point. (Previously the cap lived only in
  // serialize, which swapped in the res-29 parent of a res-30 search result —
  // a cell that fails to contain the query point ~44% of the time there.)
  if (resolution === MAX_RESOLUTION && 5 * origin.id + ((segment - origin.firstQuintant + 5) % 5) > 41) {
    resolution = MAX_RESOLUTION - 1;
  }

  vec2.copy(_scaledPoint, dodecPoint);
  if (quintant !== 0) {
    mat2.fromRotation(rotation, -2 * PI_OVER_5 * quintant);
    vec2.transformMat2(_scaledPoint, _scaledPoint, rotation);
  }
  const hilbertResolution = 1 + resolution - FIRST_HILBERT_RESOLUTION;
  const scale = 2 ** hilbertResolution;
  const px = _scaledPoint[0] * scale;
  const py = _scaledPoint[1] * scale;
  const ij = FaceToIJ([px, py] as Face);

  const base = roundToTriple(ij, hilbertResolution);
  let triple = base;
  let flavor = tripleFlavor(base);
  let margin = cellMarginScaled(px, py, base.x, base.y, flavor);
  if (margin <= 0) {
    // All deltas are relative to the ROUNDED triple (the containing pentagon
    // is always among its fixed neighbors), not to intermediate best cells.
    const deltas = NEIGHBOR_DELTAS[flavor].all;
    const maxRow = scale - 1;
    for (let i = 0; i < deltas.length; i++) {
      const d = deltas[i];
      const neighbor = {x: base.x + d.x, y: base.y + d.y, z: base.z + d.z};
      if (!tripleInBounds(neighbor, maxRow)) continue;
      const neighborFlavor = tripleFlavor(neighbor);
      const neighborMargin = cellMarginScaled(px, py, neighbor.x, neighbor.y, neighborFlavor);
      if (neighborMargin > margin) {
        triple = neighbor;
        flavor = neighborFlavor;
        margin = neighborMargin;
        if (margin > 0) break;
      }
    }
  }
  const S = tripleToS(triple, hilbertResolution, orientation);
  if (S === null) return null;
  const cellId = serialize({S, segment, origin, resolution});
  return {margin, cellId, triple, flavor, quintant, hilbertResolution, originId: origin.id, resolution};
}

/** Cache the winning pentagon for the dense-sample fast accept and return its id. */
function _acceptCandidate(c: CellCandidate): bigint {
  _lastResult = {
    cellId: c.cellId,
    pentagon: getPentagonVertices(c.hilbertResolution, c.quintant, c.triple, c.flavor),
    originId: c.originId,
    resolution: c.resolution
  };
  return c.cellId;
}

// Tie margin tolerance: containment margins are cross products of unit-scale
// pentagon edges against coordinates of magnitude up to 2^hilbertResolution,
// so their float noise is ~2^(hilbertResolution - 52); 2^-44 gives a wide
// safety factor while staying geometrically negligible (cells are unit-size
// in the scaled frame).
const TIE_EPS = 2 ** -44;

/**
 * Boundary resolution: the point has no strictly-containing pentagon in its
 * assigned frame — it lies on a cell edge, or within float noise of a quintant
 * or face seam (where the containing cell belongs to a neighboring frame).
 * Deterministically rerun the same lookup in every frame that could own the
 * point — all 5 quintants of the 3 nearest faces (a dodecahedron vertex joins
 * 3 faces; a face center joins 5 quintants). A strictly-containing pentagon is
 * unique, so the first strict hit wins; if none exists the point is exactly on
 * a boundary shared by the near-best candidates, and the tie-break is the cell
 * that comes FIRST ALONG THE CURVE — the lowest cell id (origin/segment occupy
 * the top id bits in curve order, so numeric order is curve order globally).
 */
function _sphericalToCellBoundary(
  spherical: Spherical,
  resolution: number,
  firstOrigin: Origin,
  firstQuintant: number,
  first: CellCandidate | null
): bigint {
  const candidates: CellCandidate[] = first !== null ? [first] : [];
  for (const origin of findNearestOrigins(spherical, 3)) {
    const dodecPoint = dodecahedron.forward(spherical, origin.id);
    // Try this origin's assigned quintant first, then its gamma-adjacent
    // neighbors: seam points resolve in the adjacent frame, so this order
    // finds the strict container in 1-2 lookups instead of scanning all 5.
    const q0 = getQuintantPolar(toPolar(dodecPoint));
    for (const dq of [0, 1, 4, 2, 3]) {
      const quintant = (q0 + dq) % 5;
      if (origin.id === firstOrigin.id && quintant === firstQuintant) continue;
      const c = _lookupInQuintant(dodecPoint, origin, quintant, resolution);
      if (c === null) continue;
      if (c.margin > 0) return _acceptCandidate(c);
      candidates.push(c);
    }
  }
  let best = -Infinity;
  for (const c of candidates) if (c.margin > best) best = c.margin;
  const eps = TIE_EPS * 2 ** (1 + resolution - FIRST_HILBERT_RESOLUTION);
  let winner: CellCandidate | null = null;
  for (const c of candidates) {
    if (c.margin >= best - eps && (winner === null || c.cellId < winner.cellId)) winner = c;
  }
  if (winner === null) throw new Error('sphericalToCell: no candidate cell found');
  return _acceptCandidate(winner);
}

// TODO move into tiling.ts
export function _getPentagon({S, segment, origin, resolution}: A5Cell): PentagonShape {
  const globalQuintant = origin.id * 5 + segment;
  const quintant = SEGMENT_TO_QUINTANT[globalQuintant];
  const orientation = SEGMENT_TO_ORIENTATION[globalQuintant];
  if (resolution === FIRST_HILBERT_RESOLUTION - 1) {
    const out = getQuintantVertices(quintant);
    return out;
  } else if (resolution === FIRST_HILBERT_RESOLUTION - 2) {
    return getFaceVertices();
  }

  const hilbertResolution = resolution - FIRST_HILBERT_RESOLUTION + 1;
  const {triple, flavor} = sToCell(S, hilbertResolution, orientation);
  return getPentagonVertices(hilbertResolution, quintant, triple, flavor);
}

export function cellToSpherical(cell: bigint): Spherical {
  const {S, segment, origin, resolution} = deserialize(cell);
  if (resolution >= FIRST_HILBERT_RESOLUTION) {
    // Fast path: the pentagon center is O(1) from (triple, flavor) — no need
    // to construct the pentagon itself.
    const globalQuintant = origin.id * 5 + segment;
    const quintant = SEGMENT_TO_QUINTANT[globalQuintant];
    const orientation = SEGMENT_TO_ORIENTATION[globalQuintant];
    const hilbertResolution = resolution - FIRST_HILBERT_RESOLUTION + 1;
    const {triple, flavor} = sToCell(S, hilbertResolution, orientation);
    const center = getPentagonCenter(hilbertResolution, quintant, triple, flavor);
    return dodecahedron.inverse(center as Face, origin.id);
  }
  const pentagon = _getPentagon({S, segment, origin, resolution});
  return dodecahedron.inverse(pentagon.getCenter() as Face, origin.id);
}

export function cellToLonLat(cell: bigint): LonLat {
  // WORLD_CELL represents the entire world, return [0, 0] as a reasonable default
  if (cell === WORLD_CELL) {
    return [0, 0] as LonLat;
  }

  return toLonLat(cellToSpherical(cell));
}

type CellToBoundaryOptions = {
  /**
   * Pass true to close the ring with the first point
   * @default true
   */
  closedRing?: boolean;
  /**
   * Number of segments to use for each edge. Pass 'auto' to use the resolution of the cell.
   * @default 'auto'
   */
  segments?: number | 'auto';
};

export function cellToBoundary(
  cellId: bigint,
  {closedRing = true, segments = 'auto'}: CellToBoundaryOptions = {closedRing: true, segments: 'auto'}
): LonLat[] {
  if (cellId === WORLD_CELL) {
    // WORLD_CELL represents the entire world and is unbounded
    return [];
  }

  const {S, segment, origin, resolution} = deserialize(cellId);
  if (segments === 'auto') {
    segments = Math.max(1, Math.pow(2, 6 - resolution));
  }

  const pentagon = _getPentagon({S, segment, origin, resolution});

  // Split each edge into segments before projection
  // Important to do before projection to obtain equal area cells
  const splitPentagon = pentagon.splitEdges(segments);
  const vertices = splitPentagon.getVertices();

  // Unproject to obtain lon/lat coordinates. Fused loop avoids the
  // intermediate `unprojectedVertices` allocation.
  const boundary: LonLat[] = new Array(vertices.length);
  for (let i = 0; i < vertices.length; i++) {
    boundary[i] = toLonLat(dodecahedron.inverse(vertices[i], origin.id));
  }

  // Normalize longitudes to handle antimeridian crossing
  const normalizedBoundary = normalizeLongitudes(boundary);

  if (closedRing) {
    normalizedBoundary.push(normalizedBoundary[0]);
  }
  // TODO: This is a patch to make the boundary CCW, but we should fix the winding order of the pentagon
  // throughout the whole codebase
  normalizedBoundary.reverse();
  return normalizedBoundary;
}

export function a5cellContainsPoint(cell: A5Cell, spherical: Spherical): number {
  const pentagon = _getPentagon(cell);
  const projectedPoint = dodecahedron.forward(spherical, cell.origin.id);
  return pentagon.containsPoint(projectedPoint);
}

/**
 * Tests whether the segment between two LonLat points intersects a cell.
 *
 * The test runs entirely in the cell's Face coordinate system: both endpoints
 * are projected via the dodecahedron projection (with face-plane extension for
 * points beyond the face's edge), then checked against the pentagon's straight
 * 2D edges. The segment is treated as a 2D straight line in Face coords —
 * accurate when the segment is short relative to the face (DSEA distortion is
 * negligible at sub-cell scales).
 */
export function cellIntersectsSegment(cellId: bigint, a: LonLat, b: LonLat): boolean {
  if (cellId === WORLD_CELL) return true;
  const cell = deserialize(cellId);
  const pentagon = _getPentagon(cell);
  const aFace = dodecahedron.forward(fromLonLat(a), cell.origin.id);
  const bFace = dodecahedron.forward(fromLonLat(b), cell.origin.id);
  return pentagon.intersectsSegment(aFace, bFace);
}

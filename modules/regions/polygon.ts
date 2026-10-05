// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type {LonLat, Cartesian} from '../core/coordinate-systems';
import {lonLatToCell, sphericalToCell, cellToSpherical} from '../core/cell';
import {fromLonLat, toCartesian, toSpherical} from '../core/coordinate-transforms';
import {
  cellToParent,
  cellToChildren,
  getResolution,
  deserialize,
  serialize,
  FIRST_HILBERT_RESOLUTION,
  MAX_RESOLUTION,
  WORLD_CELL
} from '../core/serialization';
import {compact} from '../core/compact';
import {ringWindingSign} from '../geometry/spherical-polygon';
import type {PreparedPolygon} from '../geometry/prepared-polygon';
import {preparePolygon, pointInPreparedPolygon} from '../geometry/prepared-polygon';
import {estimateCellRadius} from '../traversal/cap';
import {sampleGreatCircleArc} from '../utils/great-circle';
import {tripleSpaceFloodFill} from '../traversal/lattice-flood-fill';
import {
  cellIdsToTriples,
  forEachLatticeNeighbor,
  tripleCellCenter,
  tripleCellKey,
  tripleCellToId
} from '../traversal/triple-cells';

/**
 * Maps each boundary cell to the indices of the ring segments that produced it.
 * Segment indices are global across rings (outer ring first, then holes).
 * Used by `filterBoundaryCells` to short-circuit PIP via segment-side dot products.
 */
type SegmentMap = Map<bigint, number[]>;

/**
 * Dense-sample boundary cells along every closed ring (outer + holes) at
 * `cellRadius * 0.4` spacing, calling `sphericalToCell` per sample.
 */
function denseSampleBoundary(
  rings: LonLat[][],
  ringVecsList: Cartesian[][],
  resolution: number
): {boundaryCells: bigint[]; boundarySet: Set<bigint>; segmentMap: SegmentMap} {
  const boundaryCells: bigint[] = [];
  const boundarySet = new Set<bigint>();
  const segmentMap: SegmentMap = new Map();
  const cellRadius = estimateCellRadius(resolution);
  const sampleInterval = cellRadius * 0.4;

  const recordCell = (cell: bigint, segIdx: number) => {
    if (!boundarySet.has(cell)) {
      boundarySet.add(cell);
      boundaryCells.push(cell);
    }
    const existing = segmentMap.get(cell);
    if (existing) {
      if (existing[existing.length - 1] !== segIdx) existing.push(segIdx);
    } else {
      segmentMap.set(cell, [segIdx]);
    }
  };

  let segOffset = 0;
  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    const ringVecs = ringVecsList[r];

    const vertexCells: bigint[] = new Array(ring.length);
    for (let i = 0; i < ring.length; i++) {
      vertexCells[i] = lonLatToCell(ring[i], resolution);
    }

    for (let i = 0; i < ring.length; i++) {
      const nextI = (i + 1) % ring.length;
      recordCell(vertexCells[i], segOffset + i);

      // Skip the lonLat round-trip: samples are authalic-Cartesian already.
      const samples = sampleGreatCircleArc(ringVecs[i], ringVecs[nextI], sampleInterval);
      for (const s of samples) {
        recordCell(sphericalToCell(toSpherical(s), resolution), segOffset + i);
      }
      recordCell(vertexCells[nextI], segOffset + i);
    }
    segOffset += ring.length;
  }

  return {boundaryCells, boundarySet, segmentMap};
}

/**
 * Filter boundary cells to those whose center is inside the polygon.
 *
 * For each cell we know which ring segment(s) sampled it. When all of those
 * segments place the cell on the interior side (cheap signed-dot test), we
 * accept immediately. When they disagree (vertex / concave corner) or the
 * cell wasn't recorded, fall back to full PIP.
 */
function filterBoundaryCells(
  boundaryCells: bigint[],
  segmentMap: SegmentMap,
  segNormals: Cartesian[],
  segSigns: number[],
  prep: PreparedPolygon
): bigint[] {
  const out: bigint[] = [];
  for (const cell of boundaryCells) {
    const cv = toCartesian(cellToSpherical(cell));
    const segments = segmentMap.get(cell);
    if (!segments) {
      if (pointInPreparedPolygon(cv, prep)) out.push(cell);
      continue;
    }
    let allInside = true;
    let anyInside = false;
    let ambiguous = false;
    for (const segIdx of segments) {
      const n = segNormals[segIdx];
      const dot = n[0] * cv[0] + n[1] * cv[1] + n[2] * cv[2];
      if (Math.abs(dot) < 1e-14) {
        ambiguous = true;
        break;
      } // on segment within float epsilon
      if (dot * segSigns[segIdx] > 0) anyInside = true;
      else allInside = false;
    }
    if (ambiguous || (anyInside && !allInside)) {
      if (pointInPreparedPolygon(cv, prep)) out.push(cell);
    } else if (allInside) {
      out.push(cell);
    }
  }
  return out;
}

/**
 * Buffer the boundary by one cell using lattice neighbors, in triple space
 * (cells as flat (originId, quintant, x, y, z)). The shell matches the
 * connectivity of `tripleSpaceFloodFill` so the firewall (boundary + exterior
 * shell) is a tight topological barrier for the subsequent flood.
 */
function expandShell(boundary: number[], maxRow: number): number[] {
  const seen = new Set<number>();
  for (let c = 0; c < boundary.length; c += 5) {
    seen.add(tripleCellKey(boundary[c], boundary[c + 1], boundary[c + 2], boundary[c + 3], boundary[c + 4]));
  }
  const shell: number[] = [];
  const visit = (originId: number, quintant: number, x: number, y: number, z: number) => {
    const key = tripleCellKey(originId, quintant, x, y, z);
    if (seen.has(key)) return;
    seen.add(key);
    shell.push(originId, quintant, x, y, z);
  };
  for (let c = 0; c < boundary.length; c += 5) {
    const b = boundary;
    forEachLatticeNeighbor(b[c], b[c + 1], b[c + 2], b[c + 3], b[c + 4], maxRow, visit);
  }
  return shell;
}

/**
 * Hierarchical flood fill from interior seed cells. Runs a few fine BFS layers
 * to clear the boundary, then a coarse-resolution BFS through the bulk, then
 * resumes fine BFS to fill gaps near the boundary. The coarse phase is skipped
 * when the polygon is too small to amortize its setup overhead.
 *
 * The seeds, boundary and exterior shell come in triple space (cells as flat
 * (originId, quintant, x, y, z)); the boundary also as cell IDs.
 */
function floodInterior(
  seeds: number[],
  boundaryCells: bigint[],
  boundary: number[],
  exteriorShell: number[],
  resolution: number
): bigint[] {
  const hilbertRes = resolution - FIRST_HILBERT_RESOLUTION + 1;
  const seedIds: bigint[] = [];
  for (let c = 0; c < seeds.length; c += 5) {
    seedIds.push(
      tripleCellToId(seeds[c], seeds[c + 1], seeds[c + 2], seeds[c + 3], seeds[c + 4], hilbertRes, resolution)
    );
  }
  const firewall = boundary.concat(exteriorShell);

  // Isoperimetric bound: B² / (4π) is the max interior for B boundary cells.
  const maxInterior = (boundaryCells.length * boundaryCells.length) / (4 * Math.PI);
  // res 30 has a different encoding the parent-emit optimization can't use.
  const useCoarsePhase = resolution > FIRST_HILBERT_RESOLUTION && resolution < MAX_RESOLUTION && maxInterior > 1000;

  if (!useCoarsePhase) {
    const result = tripleSpaceFloodFill(firewall, seeds, resolution);
    return [...seedIds, ...result.interiorCells];
  }

  const parentRes = resolution - 1;
  const coarseFirewall = new Set<bigint>();
  for (const cell of boundaryCells) coarseFirewall.add(cellToParent(cell, parentRes));
  for (let c = 0; c < exteriorShell.length; c += 5) {
    const e = exteriorShell;
    coarseFirewall.add(
      cellToParent(tripleCellToId(e[c], e[c + 1], e[c + 2], e[c + 3], e[c + 4], hilbertRes, resolution), parentRes)
    );
  }
  for (const cell of seedIds) coarseFirewall.add(cellToParent(cell, parentRes));

  // Phase 1: short fine BFS to move the frontier off the boundary.
  const phase1 = tripleSpaceFloodFill(firewall, seeds, resolution, 3);

  // Phase 2: coarse BFS through the bulk interior.
  let coarseInteriorSet: Set<bigint> | null = null;
  const phase3Delta: number[] = [];
  const coarseInteriorCells: bigint[] = [];
  if (phase1.frontierCellIds.length > 0) {
    const coarseSeeds = new Set<bigint>();
    for (const cell of phase1.frontierCellIds) {
      const parent = cellToParent(cell, parentRes);
      if (!coarseFirewall.has(parent)) coarseSeeds.add(parent);
    }

    if (coarseSeeds.size > 0) {
      const coarseVisited = new Set(coarseFirewall);
      for (const seed of coarseSeeds) coarseVisited.add(seed);
      const coarseResult = tripleSpaceFloodFill(
        cellIdsToTriples(coarseVisited),
        cellIdsToTriples(coarseSeeds),
        parentRes
      );
      const coarseInterior = [...coarseSeeds, ...coarseResult.interiorCells];
      coarseInteriorSet = new Set(coarseInterior);
      coarseInteriorCells.push(...coarseInterior);

      // Children become firewall for phase 3; the coarse parent represents
      // them in the output, so we don't emit them individually.
      for (const coarseCell of coarseInterior) cellIdsToTriples(cellToChildren(coarseCell, resolution), phase3Delta);
    }
  }

  // Emit fine cells only when not already covered by a coarse parent.
  const interiorCells: bigint[] = [];
  if (coarseInteriorSet === null) {
    interiorCells.push(...seedIds, ...phase1.interiorCells);
  } else {
    for (const cell of seedIds) {
      if (!coarseInteriorSet.has(cellToParent(cell, parentRes))) interiorCells.push(cell);
    }
    for (const cell of phase1.interiorCells) {
      if (!coarseInteriorSet.has(cellToParent(cell, parentRes))) interiorCells.push(cell);
    }
    interiorCells.push(...coarseInteriorCells);
  }

  // Phase 3: resume fine BFS, reusing phase 1's state.
  const phase3 = tripleSpaceFloodFill({state: phase1.state, delta: phase3Delta}, phase1.frontier, resolution);
  interiorCells.push(...phase3.interiorCells);

  return interiorCells;
}

/**
 * Quintants the polygon swallows whole. The flood fill never crosses a
 * quintant edge, so such a quintant gets no seeds from the boundary shell and
 * would be left empty. A quintant holding none of the boundary or shell cells
 * has none of the polygon's edge passing through it: its cells lie wholly
 * inside or wholly outside, and a single probe cell decides which. Inside
 * quintants are emitted as their resolution 1 cell (resolution 0 when that is
 * the target), which `compact` merges with the rest of the output.
 */
function swallowedQuintants(boundary: number[], shell: number[], resolution: number, prep: PreparedPolygon): bigint[] {
  // A swallowed quintant lies inside the polygon's bounding cap, so the cap
  // must have at least a quintant's area (4π/60: cells are equal-area)
  if (2 * Math.PI * (1 - prep.cap.minDot) < (4 * Math.PI) / 60) return [];
  // Quintants by origin.id * 5 + quintant, as the triples carry them
  const touched = new Set<number>();
  for (const cells of [boundary, shell]) {
    for (let c = 0; c < cells.length; c += 5) touched.add(cells[c] * 5 + cells[c + 1]);
  }

  const out: bigint[] = [];
  const quintantCells = cellToChildren(WORLD_CELL, FIRST_HILBERT_RESOLUTION - 1);
  const quintants = cellIdsToTriples(quintantCells);
  for (let i = 0; i < quintantCells.length; i++) {
    if (touched.has(quintants[i * 5] * 5 + quintants[i * 5 + 1])) continue;
    // Any cell of the quintant at the target resolution will do
    const probe = serialize({...deserialize(quintantCells[i]), S: 0n, resolution});
    if (pointInPreparedPolygon(toCartesian(cellToSpherical(probe)), prep)) out.push(quintantCells[i]);
  }
  return out;
}

/**
 * How a cell is judged to belong to the polygon.
 * - `'center'`: a cell is included iff its center lies inside the polygon.
 * - `'overlapping'`: additionally include every cell that overlaps the polygon
 *   boundary, giving gap-free coverage (a superset of `'center'`).
 */
export type PolygonContainment = 'center' | 'overlapping';

type PolygonToCellsOptions = {
  /**
   * Which cells to include relative to the polygon.
   * @default 'center'
   */
  containment?: PolygonContainment;
};

/**
 * Find all cells within a polygon. The result is compacted — use `uncompact`
 * to expand to the input resolution.
 *
 * @param polygon - Either a single ring of [longitude, latitude] vertices, or
 *   GeoJSON-style rings `[outer, ...holes]` where cells inside a hole are
 *   excluded. Rings may be open or closed (GeoJSON-style, first vertex
 *   repeated at the end) — closure is automatic either way. Holes with fewer
 *   than 3 distinct vertices are ignored.
 * @param resolution - Target resolution (0..30)
 * @param options - `containment` selects `'center'` (default, cell center
 *   inside the polygon) or `'overlapping'` (any cell touching the polygon, for
 *   gap-free coverage).
 * @returns Sorted, compacted BigUint64Array of cell IDs
 */
export function polygonToCells(
  polygon: LonLat[] | LonLat[][],
  resolution: number,
  {containment = 'center'}: PolygonToCellsOptions = {}
): BigUint64Array {
  // Normalize: a flat ring is shorthand for a polygon with no holes.
  const isNested = polygon.length > 0 && typeof (polygon[0] as LonLat | LonLat[])[0] !== 'number';
  const inputRings = (isNested ? polygon : [polygon]) as LonLat[][];

  // GeoJSON rings repeat the first vertex at the end — drop the duplicate.
  const stripClosing = (ring: LonLat[]): LonLat[] => {
    const last = ring.length - 1;
    return last > 0 && ring[0][0] === ring[last][0] && ring[0][1] === ring[last][1] ? ring.slice(0, -1) : ring;
  };

  if (inputRings.length === 0) return new BigUint64Array(0);
  const outer = stripClosing(inputRings[0]);
  if (outer.length < 3) return new BigUint64Array(0);
  const rings: LonLat[][] = [outer];
  for (let r = 1; r < inputRings.length; r++) {
    const hole = stripClosing(inputRings[r]);
    if (hole.length >= 3) rings.push(hole);
  }

  // Authalic-sphere ring vectors — A5's internal sphere, so cell centers
  // compare directly with no geodetic↔authalic round-trip.
  const ringVecsList: Cartesian[][] = new Array(rings.length);
  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    const ringVecs: Cartesian[] = new Array(ring.length);
    for (let i = 0; i < ring.length; i++) {
      ringVecs[i] = toCartesian(fromLonLat(ring[i]));
    }
    ringVecsList[r] = ringVecs;
  }

  const prep = preparePolygon(ringVecsList);

  const {boundaryCells, boundarySet, segmentMap} = denseSampleBoundary(rings, ringVecsList, resolution);

  // Res 30 covers only quintants 0-41 (elsewhere A5 answers at res 29, see
  // serialize), so a polygon reaching past them is filled at res 29: mixing the
  // two lattices would leave the fill without a consistent grid.
  if (resolution === MAX_RESOLUTION && boundaryCells.some(cell => getResolution(cell) !== resolution)) {
    return polygonToCells(polygon, resolution - 1, {containment});
  }

  // The boundary contribution to the output. In 'overlapping' mode every
  // densely-sampled boundary cell contains a point on the polygon boundary, so
  // it overlaps the polygon — keep them all, unfiltered. In 'center' mode we
  // filter down to those whose center lies inside.
  let boundaryOut: bigint[];
  if (containment === 'overlapping') {
    boundaryOut = boundaryCells;
  } else {
    // Flattened per-segment normals and interior-side signs, indexed like the
    // segment map. The polygon interior lies on the *outside* of a hole ring,
    // so hole segments get the opposite sign.
    const segNormals: Cartesian[] = [];
    const segSigns: number[] = [];
    for (let r = 0; r < rings.length; r++) {
      const sign = (r === 0 ? 1 : -1) * ringWindingSign(ringVecsList[r]);
      const normals = prep.ringNormals[r];
      for (let i = 0; i < normals.length; i++) {
        segNormals.push(normals[i]);
        segSigns.push(sign);
      }
    }
    boundaryOut = filterBoundaryCells(boundaryCells, segmentMap, segNormals, segSigns, prep);
  }

  // Resolutions 0 and 1 have no lattice to flood (a quintant is a single
  // cell): every cell off the boundary is in or out by its center, and there
  // are at most 60 of them.
  if (resolution < FIRST_HILBERT_RESOLUTION) {
    const out = [...boundaryOut];
    for (const cell of cellToChildren(WORLD_CELL, resolution)) {
      if (!boundarySet.has(cell) && pointInPreparedPolygon(toCartesian(cellToSpherical(cell)), prep)) out.push(cell);
    }
    return compact(out);
  }

  // The rest runs in triple space: cells as flat (originId, quintant, x, y, z)
  const hilbertRes = resolution - FIRST_HILBERT_RESOLUTION + 1;
  const maxRow = (1 << hilbertRes) - 1;
  const boundary = cellIdsToTriples(boundaryCells);

  // Dense sampling can leave gaps; the shell catches them, classifying each cell.
  const shell = expandShell(boundary, maxRow);
  const swallowed = swallowedQuintants(boundary, shell, resolution, prep);
  if (shell.length === 0) return compact([...boundaryOut, ...swallowed]);

  const seeds: number[] = [];
  const exteriorShell: number[] = []; // exterior shell (and hole interiors) join the firewall
  for (let c = 0; c < shell.length; c += 5) {
    const originId = shell[c];
    const quintant = shell[c + 1];
    const x = shell[c + 2];
    const y = shell[c + 3];
    const z = shell[c + 4];
    const center = tripleCellCenter(originId, quintant, x, y, z, hilbertRes, maxRow);
    (pointInPreparedPolygon(toCartesian(center), prep) ? seeds : exteriorShell).push(originId, quintant, x, y, z);
  }
  if (seeds.length === 0) return compact([...boundaryOut, ...swallowed]);

  const interiorCells = floodInterior(seeds, boundaryCells, boundary, exteriorShell, resolution);

  return compact([...boundaryOut, ...interiorCells, ...swallowed]);
}

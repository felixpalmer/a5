// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// The spatial counterpart of the cell hierarchy. The index hierarchy nests
// cells by ID, but a cell's children do not tile it exactly: some stick out,
// and children of its neighbors poke in. Here a finer cell belongs to the
// coarser cell holding its center, so every resolution partitions every coarser
// one exactly.

import {_getPentagon, cellToSpherical, sphericalToCell} from '../core/cell';
import {FACE_ADJACENCY, seamTransform} from '../core/face-adjacency';
import {
  deserialize,
  getResolution,
  slotToCell,
  FIRST_HILBERT_RESOLUTION,
  MAX_RESOLUTION,
  RES30_QUINTANTS,
  WORLD_CELL
} from '../core/serialization';
import {getFaceVertices} from '../core/tiling';
import {slotRunsToCovering, toCovering} from '../coverings/slot-runs';
import type {SlotRuns} from '../coverings/types';
import {descendInCurveOrder, INSIDE, OUTSIDE, SPLIT} from '../traversal/curve-descent';
import type {CurveDescentClassifier} from '../traversal/curve-descent';

// How far the center of any descendant of a cell can lie from the cell's own
// center, in units of the cell's lattice spacing (face units · 2^hilbertRes). A
// child's center is within 0.342 of its parent's (the max over every flavor and
// child), and the offsets halve each level down, so all descendants lie within
// 2 · 0.342 (observed: 0.648).
const DESCENDANT_REACH = 0.7;

// Face-unit distance from the parent's edges below which a center is decided by
// `cellToSupercell` itself, so ties and float noise resolve exactly as it
// does (fine cells at resolution 30 are ~2e-9 across).
const EDGE_EPS = 1e-12;

/**
 * The cell at a coarser `resolution` that contains the center of `cell`: the
 * spatial counterpart of `cellToParent`. Unlike the parent, the supercell always
 * contains (the center of) the cell, so aggregating by supercell attributes
 * each fine cell to the coarse cell it lies in.
 *
 * @param cell - The cell
 * @param resolution - Target resolution, at most the cell's own
 * @returns The cell at `resolution` containing the center of `cell`
 */
export function cellToSupercell(cell: bigint, resolution: number): bigint {
  const cellResolution = getResolution(cell);
  if (resolution > cellResolution) {
    throw new Error(
      `Target resolution (${resolution}) must be equal to or less than current resolution (${cellResolution})`
    );
  }
  if (resolution === cellResolution) return cell;
  return sphericalToCell(cellToSpherical(cell), resolution);
}

/**
 * The cells at a finer `resolution` whose centers lie in `cell`: the spatial
 * counterpart of `cellToChildren`, and the inverse of `cellToSupercell` — a cell
 * is a subcell of exactly the supercell it maps to, so the subcells of all the
 * cells at one resolution partition every finer one. The result is compacted,
 * with a compaction marker recording the resolution — use `uncompact` to
 * expand it.
 *
 * Resolution 30 covers only part of the world (see `lonLatToCell`); for a cell
 * reaching past it, the subcells are given at resolution 29.
 *
 * @param cell - The cell
 * @param resolution - Target resolution, at least the cell's own
 * @returns Compacted cells sorted in curve order, then the compaction marker
 */
export function cellToSubcell(cell: bigint, resolution: number): BigUint64Array {
  const cellResolution = getResolution(cell);
  if (resolution < cellResolution) {
    throw new Error(
      `Target resolution (${resolution}) must be equal to or greater than current resolution (${cellResolution})`
    );
  }
  if (resolution > MAX_RESOLUTION) {
    throw new Error(`Target resolution (${resolution}) exceeds maximum resolution (${MAX_RESOLUTION})`);
  }
  if (resolution === cellResolution || cell === WORLD_CELL) return toCovering([cell], resolution);

  // Cells along a dodecahedron edge interlock with the neighboring face's, so a
  // cell's subcells can come from the faces next to its own: search each face
  // the cell's pentagon reaches into, in that face's frame (see seamTransform).
  const a5cell = deserialize(cell);
  const originId = a5cell.origin.id;
  const vertices = _getPentagon(a5cell).getVertices();
  const own = new Float64Array(10);
  for (let i = 0; i < 5; i++) {
    own[2 * i] = vertices[i][0];
    own[2 * i + 1] = vertices[i][1];
  }
  const frameOrigins = [originId];
  const frameVertices = [own];
  if (FACE_EDGES.length === 0)
    FACE_EDGES.push(
      edgeLines(
        getFaceVertices()
          .getVertices()
          .flatMap(v => [v[0], v[1]])
      )
    );
  for (let q = 0; q < 5; q++) {
    const adjacentId = FACE_ADJACENCY[originId][q][0];
    const map = seamTransform(originId, q);
    const mapped = new Float64Array(10);
    let reaches = false;
    for (let i = 0; i < 10; i += 2) {
      mapped[i] = map[0] * own[i] + map[2] * own[i + 1] + map[4];
      mapped[i + 1] = map[1] * own[i] + map[3] * own[i + 1] + map[5];
      if (signedMargin(FACE_EDGES[0], mapped[i], mapped[i + 1]) > -EDGE_EPS) reaches = true;
    }
    if (reaches) {
      frameOrigins.push(adjacentId);
      frameVertices.push(mapped);
    }
  }

  // Res-30 IDs only reach the first RES30_QUINTANTS quintants (in ID order)
  if (resolution === MAX_RESOLUTION && frameOrigins.some(id => 5 * id + 5 > RES30_QUINTANTS)) resolution--;

  // Descend each face from its resolution-1 cells, classifying a cell by the
  // signed distance of its center from the pentagon's edges, in that face's frame
  const linesByOrigin: Float64Array[] = new Array(12).fill(FACE_EDGES[0]);
  const starts: number[] = [];
  for (let f = 0; f < frameOrigins.length; f++) {
    linesByOrigin[frameOrigins[f]] = edgeLines(frameVertices[f]);
    // The resolution-1 cells: triple (0, 0, 0) of each quintant
    for (let q = 0; q < 5; q++) starts.push(frameOrigins[f], q, 0, 0, 0);
  }
  // By resolution: how far a cell's center must lie inside (or outside) for all
  // its descendants' to; none at the target, where each cell decides for itself
  const target = resolution;
  const reaches = new Float64Array(target + 1);
  for (let res = 1; res < target; res++) reaches[res] = DESCENDANT_REACH / 2 ** (res - FIRST_HILBERT_RESOLUTION + 1);
  const classify: CurveDescentClassifier = (id, res, center, slot) => {
    const margin = signedMargin(linesByOrigin[id], center[0], center[1]);
    const reach = reaches[res] + EDGE_EPS;
    if (margin > reach) return INSIDE;
    if (margin < -reach) return OUTSIDE;
    if (res < target) return SPLIT;
    // Within float noise of an edge: decide exactly as cellToSupercell does
    return cellToSupercell(slotToCell(slot, res), cellResolution) === cell ? INSIDE : OUTSIDE;
  };
  const runs: SlotRuns = [];
  descendInCurveOrder(starts, 0, target, classify, runs);
  return slotRunsToCovering(runs, target);
}

// The edge lines of the face pentagon (filled on first use)
const FACE_EDGES: Float64Array[] = [];

/**
 * A convex pentagon ([x0, y0, ..., x4, y4]) as its edge lines: inward unit
 * normal and offset, so a point's margin (`signedMargin`) is its signed distance
 * to the nearest edge line, positive inside.
 */
function edgeLines(vertices: ArrayLike<number>): Float64Array {
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < 10; i += 2) {
    cx += vertices[i] / 5;
    cy += vertices[i + 1] / 5;
  }
  const lines = new Float64Array(15);
  for (let i = 0; i < 5; i++) {
    const x1 = vertices[2 * i];
    const y1 = vertices[2 * i + 1];
    const j = i === 4 ? 0 : 2 * i + 2;
    const length = Math.hypot(vertices[j] - x1, vertices[j + 1] - y1);
    let nx = (y1 - vertices[j + 1]) / length;
    let ny = (vertices[j] - x1) / length;
    if (nx * (cx - x1) + ny * (cy - y1) < 0) {
      nx = -nx;
      ny = -ny;
    }
    lines[3 * i] = nx;
    lines[3 * i + 1] = ny;
    lines[3 * i + 2] = nx * x1 + ny * y1;
  }
  return lines;
}

function signedMargin(lines: Float64Array, x: number, y: number): number {
  let margin = Infinity;
  for (let i = 0; i < 15; i += 3) {
    const d = lines[i] * x + lines[i + 1] * y - lines[i + 2];
    if (d < margin) margin = d;
  }
  return margin;
}

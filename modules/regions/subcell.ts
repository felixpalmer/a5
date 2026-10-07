// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// The spatial counterpart of the cell hierarchy. The index hierarchy nests
// cells by ID, but a cell's children do not tile it exactly: some stick out,
// and children of its neighbors poke in. Here a finer cell belongs to the
// coarser cell holding its center, so every resolution partitions every coarser
// one exactly.

import {_getPentagon, cellToSpherical, sphericalToCell} from '../core/cell';
import type {Face} from '../core/coordinate-systems';
import {TWO_PI_OVER_5} from '../core/constants';
import {FACE_ADJACENCY} from '../core/face-adjacency';
import {origins, quintantToSegment} from '../core/origin';
import {
  deserialize,
  getResolution,
  slotToCell,
  FIRST_HILBERT_RESOLUTION,
  MAX_RESOLUTION,
  QUINTANT_SHIFT,
  WORLD_CELL
} from '../core/serialization';
import {getFaceVertices, getPentagonCenter} from '../core/tiling';
import type {OriginId} from '../core/utils';
import {curveChild, curveRoot, LEVEL0_FLAVOR} from '../lattice';
import type {CurveNode, Orientation, Triple} from '../lattice';
import {DodecahedronProjection} from '../projections/dodecahedron';
import {appendSlotRun, slotRunsToCovering, toCovering} from '../collections/slot-runs';
import type {SlotRuns} from '../collections/types';

const dodecahedron = new DodecahedronProjection();

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
 * with a compaction marker cell recording the resolution — use `uncompact` to
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
  // the cell's pentagon reaches into, in that face's frame.
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
    const [adjacentId, map] = unfold(originId, q);
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

  // Res-30 IDs only reach the first 42 quintants (origins 0-7 and part of 8)
  if (resolution === MAX_RESOLUTION && frameOrigins.some(id => id >= 8)) resolution--;

  // Walk the faces in curve order (by origin id), so the slot runs come out sorted
  const frames = frameOrigins.map((id, f) => f).sort((f, g) => frameOrigins[f] - frameOrigins[g]);
  const runs: SlotRuns = [];
  for (const f of frames) {
    walkFace(frameOrigins[f], edgeLines(frameVertices[f]), cell, cellResolution, resolution, runs);
  }
  return slotRunsToCovering(runs, resolution);
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

// By origin.id * 5 + quintant: the face across that quintant's edge, and the
// map from this face's frame into that face's, as [a, b, c, d, tx, ty] taking
// (x, y) to (a x + c y + tx, b x + d y + ty). Beyond its edges a face's frame
// extends into the neighboring face by unfolding the dodecahedron about the
// shared edge, so the map is rigid; it is fitted from three points of the
// neighbor's quintant on that edge. Filled on first use.
const UNFOLDS: [OriginId, Float64Array][] = [];

function unfold(originId: OriginId, quintant: number): [OriginId, Float64Array] {
  if (UNFOLDS.length === 0) {
    for (let o = 0; o < 12; o++) {
      for (let q = 0; q < 5; q++) {
        const [adjacentId, adjacentQuintant] = FACE_ADJACENCY[o][q];
        // Points of the neighbor's quintant (in its frame), and where they land in this one
        const to: number[] = [];
        const from: number[] = [];
        for (const [r, angle] of [
          [0.3, 0],
          [0.55, -0.4],
          [0.55, 0.4]
        ]) {
          const gamma = adjacentQuintant * TWO_PI_OVER_5 + angle;
          const point = [r * Math.cos(gamma), r * Math.sin(gamma)] as Face;
          const landed = dodecahedron.forward(dodecahedron.inverse(point, adjacentId), o as OriginId);
          to.push(point[0], point[1]);
          from.push(landed[0], landed[1]);
        }
        // Solve [to1 - to0, to2 - to0] = M [from1 - from0, from2 - from0]
        const f1x = from[2] - from[0];
        const f1y = from[3] - from[1];
        const f2x = from[4] - from[0];
        const f2y = from[5] - from[1];
        const det = f1x * f2y - f2x * f1y;
        const t1x = to[2] - to[0];
        const t1y = to[3] - to[1];
        const t2x = to[4] - to[0];
        const t2y = to[5] - to[1];
        const a = (t1x * f2y - t2x * f1y) / det;
        const c = (t2x * f1x - t1x * f2x) / det;
        const b = (t1y * f2y - t2y * f1y) / det;
        const d = (t2y * f1x - t1y * f2x) / det;
        const map = new Float64Array([
          a,
          b,
          c,
          d,
          to[0] - a * from[0] - c * from[1],
          to[1] - b * from[0] - d * from[1]
        ]);
        UNFOLDS.push([adjacentId, map]);
      }
    }
  }
  return UNFOLDS[originId * 5 + quintant];
}

// The walk's fixed inputs, shared by every level of `descend`
interface Walk {
  /** The cell's pentagon, as edge lines in the frame of the face being walked */
  lines: Float64Array;
  cell: bigint;
  cellResolution: number;
  /** Hilbert level of the target resolution */
  targetLevel: number;
  quintant: number;
  orientation: Orientation;
  /** Slot prefix of the quintant */
  prefix: bigint;
  /** Output, as sorted slot runs */
  runs: SlotRuns;
}

const LO_SPAN = 2 ** 26;

/**
 * Walk one face's cell hierarchy down from its resolution-1 cells, in curve
 * order, appending to `runs` the slots of the cells at `resolution` whose
 * centers lie in `cell` (given as the edge lines of its pentagon in this face's
 * frame). A cell whose descendants all have centers inside is output whole,
 * one whose descendants all lie outside is dropped, and the rest split: only
 * cells along the edges split, so the work follows the boundary, not the area.
 */
function walkFace(
  originId: OriginId,
  lines: Float64Array,
  cell: bigint,
  cellResolution: number,
  resolution: number,
  runs: SlotRuns
): void {
  const origin = origins[originId];
  // The quintants in curve order: by their segment's offset from the origin's first
  const order: number[] = [];
  for (let q = 0; q < 5; q++) {
    const {segment} = quintantToSegment(q, origin);
    order[(segment - origin.firstQuintant + 5) % 5] = q;
  }
  for (let k = 0; k < 5; k++) {
    const quintant = order[k];
    const orientation = quintantToSegment(quintant, origin).orientation;
    const walk: Walk = {
      lines,
      cell,
      cellResolution,
      targetLevel: resolution - FIRST_HILBERT_RESOLUTION + 1,
      quintant,
      orientation,
      prefix: BigInt(5 * originId + k) << QUINTANT_SHIFT,
      runs
    };
    descend(walk, 0, {x: 0, y: 0, z: 0}, LEVEL0_FLAVOR, curveRoot(orientation), 0, 0);
  }
}

/**
 * Visit the cell at Hilbert `level` with the given triple, flavor and descent
 * state, whose curve position s is sHi · 2^26 + sLo (split to stay exact as
 * doubles through resolution 30).
 */
function descend(
  walk: Walk,
  level: number,
  triple: Triple,
  flavor: number,
  node: CurveNode,
  sHi: number,
  sLo: number
): void {
  const center = getPentagonCenter(level, walk.quintant, triple, flavor);
  const margin = signedMargin(walk.lines, center[0], center[1]);
  const reach = level === walk.targetLevel ? 0 : DESCENDANT_REACH / 2 ** level;
  if (margin < -reach - EDGE_EPS) return;
  if (margin > reach + EDGE_EPS) {
    const unitShift = BigInt(58 - 2 * level);
    const slot = walk.prefix | (((BigInt(sHi) << 26n) | BigInt(sLo)) << unitShift);
    appendSlotRun(walk.runs, slot, slot + (1n << unitShift));
    return;
  }
  if (level === walk.targetLevel) {
    // Within float noise of an edge: decide exactly as cellToSupercell does
    const unitShift = BigInt(58 - 2 * level);
    const slot = walk.prefix | (((BigInt(sHi) << 26n) | BigInt(sLo)) << unitShift);
    if (cellToSupercell(slotToCell(slot, level + FIRST_HILBERT_RESOLUTION - 1), walk.cellResolution) === walk.cell) {
      appendSlotRun(walk.runs, slot, slot + (1n << unitShift));
    }
    return;
  }
  for (let digit = 0; digit < 4; digit++) {
    const child = curveChild(node, digit, level + 1, walk.orientation);
    const lo = sLo * 4 + digit;
    const carry = lo >= LO_SPAN ? Math.floor(lo / LO_SPAN) : 0;
    descend(walk, level + 1, child.cell.triple, child.cell.flavor, child.node, sHi * 4 + carry, lo - carry * LO_SPAN);
  }
}

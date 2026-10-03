// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// The dodecahedron unfolded along the A5 curve's face order (consecutive faces
// always share an edge), and the curve itself mapped onto it.

import type {Face, LonLat, Spherical} from 'a5/core/coordinate-systems';
import {origins, counterJump, clockwiseJump, segmentToQuintant} from 'a5/core/origin';
import type {IJ} from 'a5/core/coordinate-systems';
import type {Orientation} from 'a5/lattice';
import {RULES, DRAWS, expandOnce} from 'a5/lattice/lsystem/grammar';
import {walk} from 'a5/lattice/lsystem/turtle';
import type {AB} from 'a5/lattice/lsystem/turtle';
import {getFaceVertices} from 'a5/core/tiling';
import {IJToFace, fromLonLat, toCartesian, toLonLat} from 'a5/core/coordinate-transforms';
import {cellToBoundary, cellToSpherical} from 'a5/core/cell';
import {cellToChildren, deserialize} from 'a5/core/serialization';
import {DodecahedronProjection} from 'a5/projections/dodecahedron';

export type V2 = [number, number];
type V3 = [number, number, number];

/** How a face's quintants are threaded: the jump or the step, counterclockwise or clockwise */
export type FaceLayout = 'counterJump' | 'clockwiseJump' | 'clockwiseStep';

export const FACE_NAMES = [
  'Arctic',
  'N America',
  'S America',
  'S Atlantic',
  'N Atlantic',
  'Europe–ME',
  'Asia',
  'Australia',
  'Indian Ocean',
  'Antarctic',
  'S Pacific',
  'N Pacific'
];

/** Layout of each face, in curve order */
export const FACE_LAYOUTS: FaceLayout[] = origins.map(origin =>
  origin.orientation === counterJump
    ? 'counterJump'
    : origin.orientation === clockwiseJump
      ? 'clockwiseJump'
      : 'clockwiseStep'
);

// ---------- dodecahedron structure ----------
const dodecahedron = new DodecahedronProjection();
const d3 = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const FACE_PENTAGON = getFaceVertices().getVertices() as V2[];

const vertices: V3[] = [];
function vertexId(p: V3): number {
  for (let i = 0; i < vertices.length; i++) if (d3(vertices[i], p) < 1e-6) return i;
  vertices.push(p);
  return vertices.length - 1;
}

/** Vertex ids around each face, in the order of the face pentagon's vertices */
const faceLoops = origins.map(origin =>
  FACE_PENTAGON.map(v => vertexId(toCartesian(dodecahedron.inverse(v as Face, origin.id)) as unknown as V3))
);

// ---------- the net ----------
export interface NetFace {
  poly: V2[];
  vids: number[];
  centroid: V2;
}

function placeFirst(f: number): NetFace {
  const loop = faceLoops[f];
  const c = [0, 1, 2].map(k => loop.reduce((s, v) => s + vertices[v][k], 0) / 5) as V3;
  const n = c.map(x => x / Math.hypot(...c)) as V3;
  const d0 = vertices[loop[0]].map((x, k) => x - c[k]) as V3;
  const e1 = d0.map(x => x / Math.hypot(...d0)) as V3;
  const e2: V3 = [n[1] * e1[2] - n[2] * e1[1], n[2] * e1[0] - n[0] * e1[2], n[0] * e1[1] - n[1] * e1[0]];
  const poly = loop.map(v => {
    const d = vertices[v].map((x, k) => x - c[k]);
    return [d[0] * e1[0] + d[1] * e1[1] + d[2] * e1[2], d[0] * e2[0] + d[1] * e2[1] + d[2] * e2[2]] as V2;
  });
  return {poly, vids: loop, centroid: [0, 0]};
}

/** Unfold face f across the edge it shares with an already placed face */
function placeAcross(f: number, prev: NetFace): NetFace {
  const loop = faceLoops[f];
  const [aId, bId] = loop.filter(v => prev.vids.includes(v));
  const A2 = prev.poly[prev.vids.indexOf(aId)];
  const B2 = prev.poly[prev.vids.indexOf(bId)];
  const dAB = Math.hypot(B2[0] - A2[0], B2[1] - A2[1]);
  const ux = (B2[0] - A2[0]) / dAB;
  const uy = (B2[1] - A2[1]) / dAB;
  const poly = loop.map(v => {
    if (v === aId) return A2;
    if (v === bId) return B2;
    // Circle-circle intersection, on the far side from the previous face
    const da = d3(vertices[v], vertices[aId]);
    const db = d3(vertices[v], vertices[bId]);
    const x = (da * da - db * db + dAB * dAB) / (2 * dAB);
    const h = Math.sqrt(Math.max(0, da * da - x * x));
    const base: V2 = [A2[0] + ux * x, A2[1] + uy * x];
    const c1: V2 = [base[0] - uy * h, base[1] + ux * h];
    const c2: V2 = [base[0] + uy * h, base[1] - ux * h];
    const d1 = Math.hypot(c1[0] - prev.centroid[0], c1[1] - prev.centroid[1]);
    const d2 = Math.hypot(c2[0] - prev.centroid[0], c2[1] - prev.centroid[1]);
    return d1 >= d2 ? c1 : c2;
  });
  const centroid: V2 = [poly.reduce((s, p) => s + p[0], 0) / 5, poly.reduce((s, p) => s + p[1], 0) / 5];
  return {poly, vids: loop, centroid};
}

/** The net in curve order, rotated so the chain of faces reads left to right */
export const NET: NetFace[] = (() => {
  const net: NetFace[] = [placeFirst(0)];
  for (let f = 1; f < 12; f++) net.push(placeAcross(f, net[f - 1]));
  const [x0, y0] = net[0].centroid;
  const [x11, y11] = net[11].centroid;
  const angle = -Math.atan2(y11 - y0, x11 - x0);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rotate = ([x, y]: V2): V2 => [x * cos - y * sin, x * sin + y * cos];
  return net.map(face => ({...face, poly: face.poly.map(rotate), centroid: rotate(face.centroid)}));
})();

/**
 * Affine map from a face's own frame (where its pentagon is FACE_PENTAGON) to
 * its place on the net, fitted on three corresponding vertices
 */
const FACE_TO_NET = NET.map(face => {
  const [p0, p1, p2] = FACE_PENTAGON;
  const [q0, q1, q2] = face.poly;
  const det = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1]);
  // Solve [a b; c d] * (p - p0) = q - q0 for the two edge vectors
  const a = ((q1[0] - q0[0]) * (p2[1] - p0[1]) - (q2[0] - q0[0]) * (p1[1] - p0[1])) / det;
  const b = ((q2[0] - q0[0]) * (p1[0] - p0[0]) - (q1[0] - q0[0]) * (p2[0] - p0[0])) / det;
  const c = ((q1[1] - q0[1]) * (p2[1] - p0[1]) - (q2[1] - q0[1]) * (p1[1] - p0[1])) / det;
  const d = ((q2[1] - q0[1]) * (p1[0] - p0[0]) - (q1[1] - q0[1]) * (p2[0] - p0[0])) / det;
  return ([x, y]: V2): V2 => [q0[0] + a * (x - p0[0]) + b * (y - p0[1]), q0[1] + c * (x - p0[0]) + d * (y - p0[1])];
});

// ---------- the cells ----------
/** Cell ids at a resolution in curve order: the same order the globe's wireframe uses */
function curveCells(resolution: number): bigint[] {
  if (resolution === 0) return origins.map(origin => (BigInt(origin.id) << 58n) | (0b10n << 56n));
  const cells: bigint[] = [];
  for (let i = 0; i < 60; i++) {
    const index = (BigInt(i) << 58n) | (0b01n << 56n);
    if (resolution === 1) cells.push(index);
    else cells.push(...cellToChildren(index, resolution));
  }
  return cells;
}

export interface NetCells {
  /** Net position of every cell center, in curve order */
  centers: V2[];
  /** Net outline of every cell */
  boundaries: V2[][];
  /** Face of every cell */
  faces: number[];
}

const CELLS: NetCells[] = [];

/** The cells at a resolution, in curve order, mapped onto the net */
export function netCells(resolution: number): NetCells {
  if (!CELLS[resolution]) {
    const result: NetCells = {centers: [], boundaries: [], faces: []};
    for (const cell of curveCells(resolution)) {
      const f = deserialize(cell).origin.id;
      const toNet = (spherical: Spherical) => FACE_TO_NET[f](dodecahedron.forward(spherical, f) as unknown as V2);
      result.centers.push(toNet(cellToSpherical(cell)));
      result.boundaries.push(
        cellToBoundary(cell, {closedRing: false, segments: 1}).map(lonLat => toNet(fromLonLat(lonLat as LonLat)))
      );
      result.faces.push(f);
    }
    CELLS[resolution] = result;
  }
  return CELLS[resolution];
}

// ---------- the dual curve ----------
// The A5 curve is a turtle L-system on the triangular lattice: the turtle walks
// vertex to vertex, each unit step hosting one cell. That walk is the dual
// curve. Within a quintant it is the axiom motif expanded once per hilbert
// resolution, then rendered to draw symbols.

const AXIOMS: Record<Orientation, {axiom: string; reverse: boolean; isB: boolean}> = {
  uv: {axiom: 'A', reverse: false, isB: false},
  vu: {axiom: 'A', reverse: true, isB: false},
  uw: {axiom: 'C', reverse: false, isB: false},
  wu: {axiom: 'C', reverse: true, isB: false},
  vw: {axiom: 'B', reverse: true, isB: true},
  wv: {axiom: 'B', reverse: false, isB: true}
};

/** Turtle positions of the walk filling a quintant, in curve order: 4^R steps, so 4^R + 1 points */
function quintantWalk(hilbertResolution: number, orientation: Orientation): AB[] {
  const {axiom, reverse, isB} = AXIOMS[orientation];
  let symbols = axiom;
  for (let i = 0; i < hilbertResolution; i++) symbols = expandOnce(symbols, RULES);
  symbols = expandOnce(symbols, DRAWS);
  const positions: AB[] = [{a: 0, b: 0}];
  walk(symbols, {a: 0, b: 0}, 0, (sym, from, heading) => {
    const step = walk(sym, from, heading);
    positions.push(step.pos);
  });
  // The B motif fills the quintant corner to corner, so it is translated onto it
  // (by (-p, p, 0) in triple units, p = 2^R)
  const p = 2 ** hilbertResolution;
  const placed = isB ? positions.map(q => ({a: q.a + 4 * p, b: q.b - 4 * p})) : positions;
  return reverse ? placed.reverse() : placed;
}

/** Turtle (a,b) position -> face coordinates in quintant q's place */
function turtleToFace({a, b}: AB, hilbertResolution: number, q: number): V2 {
  const j = -b / 4;
  const i = a / 4 + b / 4;
  const [x, y] = IJToFace([i, j] as IJ).map(c => c / 2 ** hilbertResolution);
  const angle = ((2 * Math.PI) / 5) * q;
  return [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)];
}

export interface DualCurve {
  /** Net position of every walk vertex, in curve order (quintant by quintant) */
  net: V2[];
  /** Globe position of every walk vertex */
  lonLat: [number, number][];
  /** Face of every vertex */
  faces: number[];
  /** Index of the cell hosted by the step leaving each vertex (the last vertex of a quintant: its last cell) */
  index: number[];
}

const DUALS: DualCurve[] = [];

/** The dual curve at a resolution (empty at resolution 0, where there are no quintant curves) */
export function dualCurve(resolution: number): DualCurve {
  if (!DUALS[resolution]) {
    const curve: DualCurve = {net: [], lonLat: [], faces: [], index: []};
    const hilbertResolution = resolution - 1;
    if (hilbertResolution >= 0) {
      const steps = 4 ** hilbertResolution;
      origins.forEach(origin => {
        for (let j = 0; j < 5; j++) {
          const {quintant, orientation} = segmentToQuintant((origin.firstQuintant + j) % 5, origin);
          const first = (origin.id * 5 + j) * steps;
          quintantWalk(hilbertResolution, orientation).forEach((position, i) => {
            const face = turtleToFace(position, hilbertResolution, quintant);
            curve.net.push(FACE_TO_NET[origin.id](face));
            curve.lonLat.push(toLonLat(dodecahedron.inverse(face as Face, origin.id)) as unknown as [number, number]);
            curve.faces.push(origin.id);
            curve.index.push(first + Math.min(i, steps - 1));
          });
        }
      });
    }
    DUALS[resolution] = curve;
  }
  return DUALS[resolution];
}

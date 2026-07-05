// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// The A5 space-filling curve, a turtle L-system on the triangular lattice.
//
// This replaces the earlier `shiftDigits` Hilbert construction. shiftDigits was an
// approximation of this curve: they agree exactly through resolution 4, but
// shiftDigits self-intersects from resolution 5 on, whereas this curve never
// crosses itself at any resolution while tiling the exact same cells with the same
// metacell hierarchy. (The old curve remains available bit-for-bit via compat.ts,
// which runs the original two-motif grammar + the shiftDigits digit recode through
// the same descents below.)
//
// The curve is a vertex-to-vertex turtle L-system on the triangular lattice: 7
// self-referential motifs (A B C M P Q R), each a clean A5 unit (2 parallelograms
// + 2 triangles). The symbolic grammar lives in grammar.ts and is compiled
// to flat tables in tables.ts; this file evaluates it as an O(resolution)
// digit transducer:
//   forward  s -> cell   : descend the quaternary digits, accumulating a turtle
//            position + heading, then map (a,b) -> A5 triple via a fixed
//            similarity; the leaf state also yields the cell's pentagon flavor.
//   inverse  triple -> s : descend picking, at each level, the child whose convex
//            footprint (triforce / parallelogram) contains the target cell.
//
// Every turn in every rule is 180° (see tables.ts), so the descent
// tracks orientation as a single flip bit; for the A5 grammar that invariant
// is also what keeps every parallelogram cell on-axis.
//
// The 6 orientations are just which triforce motif is the axiom (uv->A, uw->C,
// vw->B) + whether the curve is reversed; A and C fill the quintant from corner
// C0, B fills it corner-to-corner so it's translated onto the quintant. See ORIENT.

import type {Orientation} from '../types';
import type {Triple} from '../triple';
import type {AB} from './turtle';
import {RULES, DRAWS} from './grammar';
import type {CurveTables} from './tables';
import {compileGrammar, POW2, POW4} from './tables';

/** The compiled A5 grammar. */
const A5 = compileGrammar(RULES, DRAWS);

/** A cell as the descent identifies it: its triple + its pentagon flavor. */
export interface Cell {
  triple: Triple;
  flavor: number;
}

// s <-> quaternary digits, via two float halves: `lo` holds digits 0-12 (26
// bits), `hi` the rest (up to 2^34 at resolution 30) — both exact as doubles,
// so the per-level work is plain number arithmetic and the BigInt boundary is
// crossed once per call.
const LO_DIGITS = 13;
const LO_BITS = 26n;
const LO_MASK = 0x3ffffffn;

// ---------- exact (a,b) corner-sum <-> A5 triple ----------
// The turtle (a,b) lattice and A5's triple frame are two views of the same
// triangular grid. Composing them, the √3 from each basis cancels, leaving an
// exact rational map: from a cell's corner sum (= 3·centroid),
//   y - z      = (2·sum.a + sum.b - 12) / 12
//   2x - y - z = (sum.b + 4) / 4
// and the parity x+y+z ∈ {0,1} pins x, y, z. No floating point.
export function abToTriple(sumA: number, sumB: number): Triple {
  if ((2 * sumA + sumB) % 12 !== 0 || sumB % 4 !== 0) {
    throw new Error(`abToTriple: off-lattice corner sum (${sumA},${sumB})`);
  }
  const yz = (2 * sumA + sumB - 12) / 12; // y - z
  const e = (sumB + 4) / 4; // 2x - y - z
  for (const parity of [0, 1]) {
    if ((e + parity) % 3 !== 0) continue;
    const x = (e + parity) / 3;
    const r = parity - x; // = y + z
    if ((r + yz) % 2 !== 0) continue;
    return {x, y: (r + yz) / 2, z: (r - yz) / 2};
  }
  throw new Error(`abToTriple: no integer triple for (${sumA},${sumB})`);
}
export function tripleToAB(t: Triple): AB {
  const b = 4 * (2 * t.x - t.y - t.z) - 4;
  return {a: (12 * (t.y - t.z) + 12 - b) / 2, b};
}

// ---------- forward: s -> leaf host cell (corner sum + flavor) ----------
// A child placed at (parent-relative) offUnit under a `flip` frame has its
// offset negated when flipped (180°); the child's own frame is
// `flip XOR child.flip`. Internal; also used by compat.ts.
export function axiomLeafCell(
  t: CurveTables,
  s: bigint,
  R: number,
  axiom: number
): {a: number; b: number; flavor: number} {
  const {childToken, childFlip, childOffA, childOffB, leafSum, leafFlavor} = t;
  const lo = Number(s & LO_MASK);
  const hi = Number(s >> LO_BITS);
  let motif = axiom,
    flip = 0;
  let posA = 0,
    posB = 0;
  for (let L = R; L >= 2; L--) {
    const idx = L - 1;
    const d = idx < LO_DIGITS ? (lo >>> (idx << 1)) & 3 : Math.floor(hi / POW4[idx - LO_DIGITS]) % 4;
    const ci = motif * 4 + d;
    const scale = flip ? -POW2[L - 2] : POW2[L - 2];
    posA += childOffA[ci] * scale;
    posB += childOffB[ci] * scale;
    flip ^= childFlip[ci];
    motif = childToken[ci];
  }
  // level 1: leaf walk (from heading 0 or 3), take the d0-th host cell
  const d0 = R >= 1 ? lo & 3 : 0;
  const base = motif * 2 + flip;
  return {
    a: 3 * posA + leafSum[base * 8 + d0 * 2],
    b: 3 * posB + leafSum[base * 8 + d0 * 2 + 1],
    flavor: leafFlavor[base * 4 + d0]
  };
}

// ---------- inverse: descend by which child's convex footprint contains the target ----------
// `ta`/`tb` is the target in the corner-sum frame (= 3x the (a,b) point frame):
// a cell's corner sum for the exact triple path, or 3x a fractional point for
// direct point location. For each footprint edge we cross the UNIT edge direction
// with (target - corner); > 0 for every edge means the target is inside.
//
// Early exits (exact for both target kinds): the children tile the parent, so a
// strictly-inside child (min cross > 0) is unique and ends the scan; and an edge
// cross that is both <= 0 and <= the best score so far can neither be strictly
// inside nor win the argmax fallback, so the edge loop aborts. Targets on a
// boundary (fractional points only) fall through to the argmax, matching the
// exhaustive scan.
function insideScore(
  t: CurveTables,
  motif: number,
  flip: number,
  lvl: number,
  posA: number,
  posB: number,
  ta: number,
  tb: number,
  best: number
): number {
  const scale = POW2[lvl - 1];
  const edges = t.fpEdges[motif * 2 + flip];
  let minCross = Infinity;
  for (let e = 0; e < edges.length; e += 4) {
    const dta = ta - (3 * posA + edges[e] * scale);
    const dtb = tb - (3 * posB + edges[e + 1] * scale);
    const cross = edges[e + 2] * dtb - edges[e + 3] * dta;
    if (cross < minCross) {
      minCross = cross;
      if (minCross <= 0 && minCross <= best) return minCross;
    }
  }
  return minCross;
}

// Shared descent for both leaf modes. `exact` targets are corner sums of real
// cells (leaf resolved by exact sum match); fractional targets resolve the leaf
// by point-in-cell over the 4 level-1 triangles. Internal; also used by compat.ts.
export function axiomTargetToS(
  t: CurveTables,
  ta: number,
  tb: number,
  R: number,
  axiom: number,
  exact: boolean
): bigint {
  const {childToken, childFlip, childOffA, childOffB, leafSum, leafTri} = t;
  let motif = axiom,
    flip = 0;
  let posA = 0,
    posB = 0;
  let sLo = 0,
    sHi = 0;
  for (let L = R; L >= 2; L--) {
    const scale = POW2[L - 2];
    const sign = flip ? -scale : scale;
    let bestD = 0,
      bestScore = -Infinity;
    for (let d = 0; d < 4; d++) {
      const ci = motif * 4 + d;
      const score = insideScore(
        t,
        childToken[ci],
        flip ^ childFlip[ci],
        L - 1,
        posA + childOffA[ci] * sign,
        posB + childOffB[ci] * sign,
        ta,
        tb,
        bestScore
      );
      if (score > bestScore) {
        bestScore = score;
        bestD = d;
        if (score > 0) break; // strictly inside: the unique containing child
      }
    }
    const ci = motif * 4 + bestD;
    posA += childOffA[ci] * sign;
    posB += childOffB[ci] * sign;
    flip ^= childFlip[ci];
    motif = childToken[ci];
    const idx = L - 1;
    if (idx < LO_DIGITS) sLo += bestD * POW4[idx];
    else sHi += bestD * POW4[idx - LO_DIGITS];
  }
  // level 1: pick the leaf cell, by exact corner-sum match or point-in-cell
  const base = motif * 2 + flip;
  let d0 = 0;
  if (exact) {
    const relA = ta - 3 * posA,
      relB = tb - 3 * posB;
    d0 = -1;
    for (let d = 0; d < 4; d++) {
      if (leafSum[base * 8 + d * 2] === relA && leafSum[base * 8 + d * 2 + 1] === relB) {
        d0 = d;
        break;
      }
    }
    if (d0 < 0) throw new Error(`lsystem inverse: no leaf match for corner sum (${ta},${tb})`);
  } else {
    let bestScore = -Infinity;
    for (let d = 0; d < 4; d++) {
      let minCross = Infinity;
      for (let e = 0; e < 3; e++) {
        const o = base * 48 + d * 12 + e * 4;
        const dta = ta - (3 * posA + leafTri[o]);
        const dtb = tb - (3 * posB + leafTri[o + 1]);
        const cross = leafTri[o + 2] * dtb - leafTri[o + 3] * dta;
        if (cross < minCross) minCross = cross;
      }
      if (minCross > bestScore) {
        bestScore = minCross;
        d0 = d;
        if (minCross > 0) break;
      }
    }
  }
  sLo += d0;
  return R > LO_DIGITS ? (BigInt(sHi) << LO_BITS) | BigInt(sLo) : BigInt(sLo);
}

// ---------- orientation = which triforce motif is the axiom ----------
// Each orientation is one of the three triforce motifs used as the axiom
// (uv->A, uw->C, wv->B), with the reverse orientations (vu, wu, vw) walking the
// same curve backward (s -> N-1-s). A and C fill the quintant from corner C0
// (tau 0); B fills it corner-to-corner (C1<->C2), so it's translated onto the
// quintant by tau = (-p, p, 0) in triple units, p = 2^resolution — which is
// (+12p, -12p) in the corner-sum frame.
interface OrientRecipe {
  axiom: number;
  reverse: boolean;
  isB: boolean;
}
const ORIENT: Record<Orientation, OrientRecipe> = {
  uv: {axiom: A5.motifIdx['A'], reverse: false, isB: false},
  vu: {axiom: A5.motifIdx['A'], reverse: true, isB: false},
  uw: {axiom: A5.motifIdx['C'], reverse: false, isB: false},
  wu: {axiom: A5.motifIdx['C'], reverse: true, isB: false},
  vw: {axiom: A5.motifIdx['B'], reverse: true, isB: true},
  wv: {axiom: A5.motifIdx['B'], reverse: false, isB: true}
};

/**
 * The A5 curve position `s` -> cell (triple coordinate + pentagon flavor), for
 * a given resolution and orientation. The triple is bijective with
 * {@link tripleToSLattice}.
 */
export function sToCell(s: bigint, resolution: number, orientation: Orientation = 'uv'): Cell {
  const N = 1n << BigInt(2 * resolution);
  const rec = ORIENT[orientation];
  const sAxiom = rec.reverse ? N - 1n - s : s;
  const cell = axiomLeafCell(A5, sAxiom, resolution, rec.axiom);
  const base = abToTriple(cell.a, cell.b);
  if (!rec.isB) return {triple: base, flavor: cell.flavor};
  const p = POW2[resolution];
  return {triple: {x: base.x - p, y: base.y + p, z: base.z}, flavor: cell.flavor};
}

/**
 * The A5 curve position `s` -> triple coordinate, for a given resolution and
 * orientation. Bijective with {@link tripleToSLattice}.
 */
export function sToTriple(s: bigint, resolution: number, orientation: Orientation = 'uv'): Triple {
  return sToCell(s, resolution, orientation).triple;
}

/**
 * Triple coordinate -> the A5 curve position `s`, for a given resolution and
 * orientation. Inverse of {@link sToTriple}.
 */
export function tripleToSLattice(triple: Triple, resolution: number, orientation: Orientation = 'uv'): bigint {
  const N = 1n << BigInt(2 * resolution);
  const rec = ORIENT[orientation];
  const ab = tripleToAB(triple);
  const tauSum = rec.isB ? 12 * POW2[resolution] : 0;
  const sAxiom = axiomTargetToS(A5, ab.a - tauSum, ab.b + tauSum, resolution, rec.axiom, true);
  return rec.reverse ? N - 1n - sAxiom : sAxiom;
}

/**
 * Fractional point -> the curve position `s` of the containing cell, by direct
 * descent. The target is given in the corner-sum frame (= 3x the L-system (a,b)
 * point frame); callers map their coordinate system into it (for the IJ plane
 * the exact affine map is target = (12*(i+j), -12*j), see curve.ts).
 */
export function sumPointToS(ta: number, tb: number, resolution: number, orientation: Orientation = 'uv'): bigint {
  const N = 1n << BigInt(2 * resolution);
  const rec = ORIENT[orientation];
  const tauSum = rec.isB ? 12 * POW2[resolution] : 0;
  const sAxiom = axiomTargetToS(A5, ta - tauSum, tb + tauSum, resolution, rec.axiom, false);
  return rec.reverse ? N - 1n - sAxiom : sAxiom;
}

// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// Compiles an L-system grammar into flat numeric tables, once at module init,
// so the descents in index.ts are pure scalar arithmetic: no string
// expansion and no object allocation per call.
//
// Every grammar compiled here keeps every turn inside a rule at 180°
// (`+++`/`---`), so a child is only ever placed un-flipped or flipped (rotated
// 180°) relative to its parent — never at 60°. compileGrammar enforces that
// invariant and records the orientation as a single `flip` bit (180° = negate
// on this lattice); the whole descent then tracks orientation as one boolean.
// For the A5 grammar the invariant is also what keeps every parallelogram cell
// on-axis; the compat W/Z grammar is the original two-motif curve re-gauged
// into this form (see compat.ts).
//
// Motif tokens are indexed by their position in the motif list (uppercase
// motifs first, then their lowercase reverses); a descent state is
// (motif index, flip bit). All hot-path lookups are flat typed-array reads
// indexed by that state.

import {reverseMotif, expandOnce} from './grammar';
import type {AB} from './turtle';
import {hostSum, hostCorners, walk, netOf} from './turtle';

/** Flat numeric tables for one grammar, consumed by the descents in index.ts. */
export interface CurveTables {
  motifIdx: Record<string, number>;
  // children: entry ci = motif * 4 + digit
  childToken: Int32Array;
  childFlip: Uint8Array;
  childOffA: Float64Array;
  childOffB: Float64Array;
  // footprint hulls per (motif, flip): edge list [3*c0.a, 3*c0.b, d.a, d.b]*E
  fpEdges: Float64Array[];
  // leaf tables per (motif, flip): 4 host cells as corner sums and pentagon flavors
  leafSum: Float64Array;
  leafFlavor: Uint8Array;
  // Branchless child classifier per state k = motif*2+flip: 3 separating lines
  // (classSep[k*9 ..] = [nx0,ny0,c0, nx1,ny1,c1, nx2,ny2,c2]) evaluated against
  // the normalised target give a 3-bit pattern; classLut[k*8 + pat] is the child
  // digit. Replaces the exact-path 4-hull scan with 3 dot products + a LUT read.
  classSep: Float64Array;
  classLut: Uint8Array;
}

type Bsp = {leaf: number} | {nx: number; ny: number; c: number; pos: Bsp; neg: Bsp};

export const BSP_EPS = 1e-6;

/** The 4 child footprint polygons for state (motif, pflip), normalised (scale-invariant). */
function childPolys(t: CurveTables, motif: number, pflip: number): [number, number[][]][] {
  const psign = pflip ? -1 : 1;
  const out: [number, number[][]][] = [];
  for (let d = 0; d < 4; d++) {
    const ci = motif * 4 + d;
    const tok = t.childToken[ci];
    const cfl = t.childFlip[ci];
    const oa = t.childOffA[ci];
    const ob = t.childOffB[ci];
    const edges = t.fpEdges[tok * 2 + (pflip ^ cfl)];
    const verts: number[][] = [];
    for (let e = 0; e < edges.length; e += 4) verts.push([3 * oa * psign + edges[e], 3 * ob * psign + edges[e + 1]]);
    out.push([d, verts]);
  }
  return out;
}

/** Build a child-selection BSP; children tile convexly, so a polygon edge cleanly splits them. */
function buildBsp(children: [number, number[][]][]): Bsp {
  if (children.length === 1) return {leaf: children[0][0]};
  for (const [, poly] of children) {
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % n];
      const nx = y2 - y1,
        ny = -(x2 - x1),
        c = -(nx * x1 + ny * y1);
      const pos: [number, number[][]][] = [];
      const neg: [number, number[][]][] = [];
      let ok = true;
      for (const [d, cp] of children) {
        let mn = Infinity,
          mx = -Infinity;
        for (const [x, y] of cp) {
          const val = nx * x + ny * y + c;
          if (val < mn) mn = val;
          if (val > mx) mx = val;
        }
        if (mn >= -BSP_EPS) pos.push([d, cp]);
        else if (mx <= BSP_EPS) neg.push([d, cp]);
        else {
          ok = false;
          break;
        }
      }
      if (ok && pos.length && neg.length) return {nx, ny, c, pos: buildBsp(pos), neg: buildBsp(neg)};
    }
  }
  throw new Error('lsystem: no clean BSP split for child set');
}

function collectSeps(tree: Bsp, seps: [number, number, number][]): void {
  if ('leaf' in tree) return;
  const key: [number, number, number] = [tree.nx, tree.ny, tree.c];
  if (!seps.some(s => s[0] === key[0] && s[1] === key[1] && s[2] === key[2])) seps.push(key);
  collectSeps(tree.pos, seps);
  collectSeps(tree.neg, seps);
}

function walkBsp(tree: Bsp, p: number, seps: [number, number, number][]): number {
  if ('leaf' in tree) return tree.leaf;
  const idx = seps.findIndex(s => s[0] === tree.nx && s[1] === tree.ny && s[2] === tree.c);
  return walkBsp((p >> idx) & 1 ? tree.pos : tree.neg, p, seps);
}

// The pentagon FLAVOR (0-3) of the cell a draw symbol hosts: which of the four
// pentagon orientations of the Cairo-like metatile it gets. The pentagon is a
// 1:1 function of the cell's jigsaw piece and reduces to the closed-form rule
//   flavor = BASE[symbol] XOR isLowercase XOR (heading & 1)
// with BASE = {S:0, D:1, E:2, T:3}; bit 0 is a 180° rotation, bit 1 a Y
// reflection of the base pentagon (see core/tiling.ts). Derived and verified
// exhaustively against the pentagon geometry.
const FLAVOR_BASE: Record<string, number> = {S: 0, D: 1, E: 2, T: 3};

/**
 * Compile a grammar (motif rules + leaf draws) into flat descent tables.
 * Lowercase motifs are the uppercase rules reversed, generated automatically.
 */
export function compileGrammar(rules: Record<string, string>, draws: Record<string, string>): CurveTables {
  const motifs = Object.keys(rules);
  const allMotifs = [...motifs, ...motifs.map(m => m.toLowerCase())];
  const motifCount = allMotifs.length;
  const motifIdx: Record<string, number> = {};
  allMotifs.forEach((m, i) => (motifIdx[m] = i));

  // Expand a motif to a pure draw string: `level` rule passes, then one draws
  // pass (turning every remaining motif into its leaf terminal).
  function toDraws(motif: string, level: number): string {
    let s = motif;
    for (let i = 0; i < level; i++) s = expandOnce(s, rules);
    return expandOnce(s, draws);
  }
  const motifNet = (motif: string): AB => netOf(toDraws(motif, 1)).disp;

  // ---------- child tables: 4 children per motif ----------
  interface Child {
    token: string;
    offUnit: AB; // offset from the parent origin, in net(·,1) units
    flip: boolean;
  }
  function childTable(rule: string): Child[] {
    let pos: AB = {a: 0, b: 0},
      h = 0;
    const children: Child[] = [];
    for (const ch of rule) {
      if (ch === '+') {
        h = (h + 1) % 6;
        continue;
      }
      if (ch === '-') {
        h = (h + 5) % 6;
        continue;
      }
      if (rules[ch.toUpperCase()] === undefined) continue;
      if (h !== 0 && h !== 3) throw new Error(`lsystem: non-180° turn (${60 * h}°) before a child in rule "${rule}"`);
      const flip = h === 3;
      children.push({token: ch, offUnit: {...pos}, flip});
      const n = motifNet(ch);
      pos = flip ? {a: pos.a - n.a, b: pos.b - n.b} : {a: pos.a + n.a, b: pos.b + n.b};
    }
    if (children.length !== 4) throw new Error(`lsystem: rule "${rule}" must have 4 children`);
    return children;
  }
  const childrenOf: Record<string, Child[]> = {};
  for (const m of motifs) childrenOf[m] = childTable(rules[m]);
  for (const m of motifs) childrenOf[m.toLowerCase()] = childTable(reverseMotif(rules[m]));

  const childToken = new Int32Array(motifCount * 4);
  const childFlip = new Uint8Array(motifCount * 4);
  const childOffA = new Float64Array(motifCount * 4);
  const childOffB = new Float64Array(motifCount * 4);
  for (const m of allMotifs) {
    const cs = childrenOf[m];
    for (let d = 0; d < 4; d++) {
      const ci = motifIdx[m] * 4 + d;
      childToken[ci] = motifIdx[cs[d].token];
      childFlip[ci] = cs[d].flip ? 1 : 0;
      childOffA[ci] = cs[d].offUnit.a;
      childOffB[ci] = cs[d].offUnit.b;
    }
  }

  // ---------- footprint hulls (convex hull of leaf host corners) ----------
  function convexHull(pts: AB[]): AB[] {
    const p = [...new Map(pts.map(q => [`${q.a},${q.b}`, q])).values()].sort((x, y) => x.a - y.a || x.b - y.b);
    if (p.length < 3) return p;
    const cross = (o: AB, a: AB, b: AB) => (a.a - o.a) * (b.b - o.b) - (a.b - o.b) * (b.a - o.a);
    const lower: AB[] = [];
    for (const q of p) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
      lower.push(q);
    }
    const upper: AB[] = [];
    for (let i = p.length - 1; i >= 0; i--) {
      const q = p[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
      upper.push(q);
    }
    return lower.slice(0, -1).concat(upper.slice(0, -1));
  }

  // per (motif, flip): edge list [3*c0.a, 3*c0.b, d.a, d.b]*E.
  // The corner is pre-tripled (the descent works in the corner-sum frame, = 3x
  // the (a,b) point frame); the edge direction stays UNIT so the containment
  // cross products stay ~O(2^R) instead of O(2^2R) — exact integer at every
  // resolution. The flipped variant is the hull negated (180° = negate,
  // winding-preserving).
  const fpEdges: Float64Array[] = new Array(motifCount * 2);
  for (const m of allMotifs) {
    const corners: AB[] = [];
    walk(toDraws(m, 1), {a: 0, b: 0}, 0, (sym, from, h) => corners.push(...hostCorners(sym, from, h)));
    const hull = convexHull(corners);
    for (let flip = 0; flip < 2; flip++) {
      const sign = flip ? -1 : 1;
      const edges = new Float64Array(hull.length * 4);
      for (let i = 0; i < hull.length; i++) {
        const c0 = hull[i],
          c1 = hull[(i + 1) % hull.length];
        edges[i * 4] = 3 * sign * c0.a;
        edges[i * 4 + 1] = 3 * sign * c0.b;
        edges[i * 4 + 2] = sign * (c1.a - c0.a);
        edges[i * 4 + 3] = sign * (c1.b - c0.b);
      }
      fpEdges[motifIdx[m] * 2 + flip] = edges;
    }
  }

  // ---------- leaf tables: per (motif, flip = heading 0|3) the 4 level-1 host cells ----------
  //  - corner sums relative to the descent position: sum = 3*pos + leafSum[..]
  //  - the cell's pentagon flavor
  const leafSum = new Float64Array(motifCount * 2 * 8);
  const leafFlavor = new Uint8Array(motifCount * 2 * 4);
  for (const m of allMotifs) {
    const drawStr = toDraws(m, 1);
    for (let flip = 0; flip < 2; flip++) {
      const base = motifIdx[m] * 2 + flip;
      let d = 0;
      walk(drawStr, {a: 0, b: 0}, flip ? 3 : 0, (sym, from, hh) => {
        const sum = hostSum(sym, from, hh);
        leafSum[base * 8 + d * 2] = sum.a;
        leafSum[base * 8 + d * 2 + 1] = sum.b;
        const upper = sym.toUpperCase();
        if (FLAVOR_BASE[upper] === undefined) throw new Error(`lsystem: no pentagon flavor for draw symbol ${sym}`);
        leafFlavor[base * 4 + d] = FLAVOR_BASE[upper] ^ (sym === upper ? 0 : 1) ^ (hh & 1);
        d++;
      });
    }
  }

  const tables: CurveTables = {
    motifIdx,
    childToken,
    childFlip,
    childOffA,
    childOffB,
    fpEdges,
    leafSum,
    leafFlavor,
    classSep: new Float64Array(motifCount * 2 * 9),
    classLut: new Uint8Array(motifCount * 2 * 8)
  };
  // ---------- branchless child classifier (3 line tests + LUT per state) ----------
  for (let m = 0; m < motifCount; m++) {
    for (let f = 0; f < 2; f++) {
      const k = m * 2 + f;
      const tree = buildBsp(childPolys(tables, m, f));
      const seps: [number, number, number][] = [];
      collectSeps(tree, seps);
      for (let i = 0; i < seps.length; i++) {
        tables.classSep[k * 9 + i * 3] = seps[i][0];
        tables.classSep[k * 9 + i * 3 + 1] = seps[i][1];
        tables.classSep[k * 9 + i * 3 + 2] = seps[i][2];
      }
      for (let p = 0; p < 8; p++) tables.classLut[k * 8 + p] = walkBsp(tree, p, seps);
    }
  }
  return tables;
}

// powers of 2 / 4 used by the descents (index by level / digit position)
export const POW2 = new Float64Array(32);
for (let i = 0; i < 32; i++) POW2[i] = 2 ** i;
export const POW4 = new Float64Array(20);
for (let i = 0; i < 20; i++) POW4[i] = 4 ** i;

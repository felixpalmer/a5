// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// The ORIGINAL A5 curve (the shiftDigits construction), expressed on top of the
// L-system machinery — bit-for-bit compatible with the pre-L-system library.
//
// The old construction is two layers, and both are preserved here exactly:
//
// 1. The base ordering is a simple two-motif L-system (the "original quaternary
//    curve" the A5 curve grew out of), verified index-for-index equal to the
//    old raw descent. Its native form uses ±60° turns
//    (X: X-Y+X++Y--  Y: Y+X-Y--X++, draws X -> E, Y -> -e+), but it re-gauges
//    into the 180°-only form the table compiler requires — the ±60° is
//    absorbed into Z's leaf gauge (a walk-identical re-gauging):
//      W: W+++Z---WZ   Z: Z+++W---ZW    (draws W -> E, Z -> +e-)
// 2. On top of it, the shiftDigits digit recode (ported verbatim below), which
//    rearranges children so they overlap their parent cells — the "hierarchy
//    fix" that introduced the self-intersections the new curve removes.
//
// Orientations follow the old engine exactly: reverse remaps s -> N-1-s,
// flipIJ (uw/wu) selects the flipped pattern and mirrors the raw cell
// (x <-> z in triple space), invertJ (vw/wv) flips the quintant vertically
// ((x,y,z) -> (y-(n-1), x+(n-1), z), n = 2^res). Both maps are self-inverse.
//
// Everything here was validated bit-for-bit against the original engine:
// 101k cells (triples, flavors, round-trips) + 84k interior encode points,
// all orientations, and the full public API with compat wired in as the curve
// (45k comparisons vs the pre-L-system build, zero differences). The
// fractional point-location (compatIJToS) and the flavor derivation are the
// old engine's own logic ported verbatim, so they agree on boundary
// tie-breaks too. The compat fixtures (tests/fixtures/lattice/compat.json)
// pin this behavior.

import type {Orientation, Triple} from './types';
import type {IJ} from '../core/coordinate-systems';
import {compileGrammar, POW2} from './lsystem/tables';
import type {Cell} from './lsystem';
import {axiomLeafCell, axiomTargetToS, abToTriple, tripleToAB} from './lsystem';

/** The compiled two-motif grammar of the original curve (W/Z gauge). */
const ORIGINAL = compileGrammar({W: 'W+++Z---WZ', Z: 'Z+++W---ZW'}, {W: 'E', Z: '+e-'});
const AXIOM_W = ORIGINAL.motifIdx['W'];

// ---------- shiftDigits (ported verbatim from the original construction) ----------
// Patterns used to rearrange the cells when shifting. This adjusts the layout
// so that children always overlap with their parent cells.
function reversePattern(pattern: number[]): number[] {
  return Array.from({length: pattern.length}, (_, i) => pattern.indexOf(i));
}
const PATTERN = [0, 1, 3, 4, 5, 6, 7, 2];
const PATTERN_FLIPPED = [0, 1, 2, 7, 3, 4, 5, 6];
const PATTERN_REVERSED = reversePattern(PATTERN);
const PATTERN_FLIPPED_REVERSED = reversePattern(PATTERN_FLIPPED);

function shiftDigits(digits: number[], i: number, flips: [number, number], invertJ: boolean, pattern: number[]): void {
  if (i <= 0) return;

  const parentK = digits[i] || 0;
  const childK = digits[i - 1];
  const F = flips[0] + flips[1];

  // Detect when cells need to be shifted
  let needsShift: boolean = true;
  let first: boolean = true;

  // The value of F which cells need to be shifted
  // The rule is flipped depending on the orientation, specifically on the value of invertJ
  if (invertJ !== (F === 0)) {
    needsShift = parentK === 1 || parentK === 2; // Second & third pentagons only
    first = parentK === 1; // Second pentagon is first
  } else {
    needsShift = parentK < 2; // First two pentagons only
    first = parentK === 0; // First pentagon is first
  }
  if (!needsShift) return;

  // Apply the pattern by setting the digits based on the value provided
  const src = first ? childK : childK + 4;
  const dst = pattern[src];
  digits[i - 1] = dst % 4;
  digits[i] = (parentK + 4 + Math.floor(dst / 4) - Math.floor(src / 4)) % 4;
}

// the flips product accumulates per digit exactly as quaternaryToFlips did:
// digit 1 flips the second component, digit 3 the first
function applyDigitFlips(flips: [number, number], d: number): void {
  if (d === 1) flips[1] = -flips[1];
  else if (d === 3) flips[0] = -flips[0];
}

/**
 * old s digits -> geometric (X/Y curve) digits, in place. LSB-first array.
 * Returns the final flips product over the shifted digits — the old engine's
 * anchor `flips` state, from which the pentagon flavor follows in closed form
 * (see compatFlavor).
 */
function forwardShift(digits: number[], invertJ: boolean, flipIJ: boolean): [number, number] {
  const pattern = flipIJ ? PATTERN_FLIPPED : PATTERN;
  const flips: [number, number] = [1, 1];
  for (let i = digits.length - 1; i >= 0; i--) {
    shiftDigits(digits, i, flips, invertJ, pattern);
    applyDigitFlips(flips, digits[i]);
  }
  return flips;
}

/**
 * geometric (X/Y curve) digits -> old s digits, in place. LSB-first array.
 * The flips state starts as the product over ALL digits and each iteration
 * cancels digit i's contribution — so at step i it holds the product of the
 * digits ABOVE i, matching the forward pass's state at the same level (this
 * mirrors how the original engine carried the flips of its geometric descent
 * into its reordering loop without resetting them).
 */
function inverseShift(digits: number[], invertJ: boolean, flipIJ: boolean): void {
  const pattern = flipIJ ? PATTERN_FLIPPED_REVERSED : PATTERN_REVERSED;
  const flips: [number, number] = [1, 1];
  for (let i = 0; i < digits.length; i++) applyDigitFlips(flips, digits[i]);
  for (let i = 0; i < digits.length; i++) {
    applyDigitFlips(flips, digits[i]);
    shiftDigits(digits, i, flips, invertJ, pattern);
  }
}

function digitsOf(s: bigint, resolution: number): number[] {
  const digits: number[] = [];
  let v = s;
  while (v > 0n || digits.length < resolution) {
    digits.push(Number(v & 3n));
    v >>= 2n;
  }
  return digits;
}

function packDigits(digits: number[]): bigint {
  let s = 0n;
  for (let i = digits.length - 1; i >= 0; i--) s = (s << 2n) | BigInt(digits[i]);
  return s;
}

// ---------- orientations (as in the old engine) ----------
interface CompatRecipe {
  reverse: boolean;
  invertJ: boolean;
  flipIJ: boolean;
}
const COMPAT_ORIENT: Record<Orientation, CompatRecipe> = {
  uv: {reverse: false, invertJ: false, flipIJ: false},
  vu: {reverse: true, invertJ: false, flipIJ: false},
  uw: {reverse: false, invertJ: false, flipIJ: true},
  wu: {reverse: true, invertJ: false, flipIJ: true},
  vw: {reverse: true, invertJ: true, flipIJ: false},
  wv: {reverse: false, invertJ: true, flipIJ: false}
};

/**
 * Pentagon flavor from the old engine's anchor state: the flips product over
 * the (shifted) digits and the leaf digit `q`. Ported from the old
 * getPentagonVertices orientation logic: flavor bit 0 (180° rotation) fired
 * iff `flips[1] === YES`; bit 1 (Y reflection) on the `(F, q)` predicate
 * below. This is why the compat decode needs no second (A5) descent — the
 * old engine's own fractal flips field carries the missing flavor bit.
 */
function compatFlavor(flips: [number, number], q: number): number {
  const rotate = flips[1] === -1 ? 1 : 0;
  const F = flips[0] + flips[1];
  // Orient last two pentagons when both or neither flips are set,
  // first & last pentagons when exactly one is.
  const reflect = (F === 0 ? q === 0 || q === 3 : q === 2 || q === 3) ? 1 : 0;
  return rotate | (reflect << 1);
}

/** Shared forward descent: old s digits -> (triple, anchor flips, leaf digit). */
function compatDescend(
  s: bigint,
  resolution: number,
  rec: CompatRecipe
): {triple: Triple; flips: [number, number]; q: number} {
  const N = 1n << BigInt(2 * resolution);
  const v = rec.reverse ? N - 1n - s : s;
  const digits = digitsOf(v, resolution);
  const flips = forwardShift(digits, rec.invertJ, rec.flipIJ);
  const raw = axiomLeafCell(ORIGINAL, packDigits(digits), resolution, AXIOM_W);
  let triple = abToTriple(raw.a, raw.b);
  if (rec.flipIJ) {
    triple = {x: triple.z, y: triple.y, z: triple.x};
  }
  if (rec.invertJ) {
    const n1 = POW2[resolution] - 1;
    triple = {x: triple.y - n1, y: triple.x + n1, z: triple.z};
  }
  return {triple, flips, q: digits.length > 0 ? digits[0] : 0};
}

/**
 * Old-curve position `s` -> triple coordinate, via the ORIGINAL (W/Z) forward
 * descent + shiftDigits recode.
 */
export function compatSToTriple(s: bigint, resolution: number, orientation: Orientation = 'uv'): Triple {
  return compatDescend(s, resolution, COMPAT_ORIENT[orientation]).triple;
}

/** Old-curve position `s` -> cell (triple + pentagon flavor). */
export function compatSToCell(s: bigint, resolution: number, orientation: Orientation = 'uv'): Cell {
  const rec = COMPAT_ORIENT[orientation];
  const {triple, flips, q} = compatDescend(s, resolution, rec);
  // As in the old engine's sToAnchor: invertJ flips the first component
  // (flipIJ leaves the flips untouched).
  if (rec.invertJ) {
    flips[0] = -flips[0];
  }
  return {triple, flavor: compatFlavor(flips, q)};
}

/** Triple -> old-curve position `s`, or null if the triple has invalid parity. */
export function compatTripleToS(t: Triple, resolution: number, orientation: Orientation = 'uv'): bigint | null {
  const sum = t.x + t.y + t.z;
  if (sum !== 0 && sum !== 1) return null;
  const N = 1n << BigInt(2 * resolution);
  const rec = COMPAT_ORIENT[orientation];
  let raw = t;
  if (rec.invertJ) {
    const n1 = POW2[resolution] - 1;
    raw = {x: raw.y - n1, y: raw.x + n1, z: raw.z};
  }
  if (rec.flipIJ) {
    raw = {x: raw.z, y: raw.y, z: raw.x};
  }
  const ab = tripleToAB(raw);
  const sGeo = axiomTargetToS(ORIGINAL, ab.a, ab.b, resolution, AXIOM_W)[0];
  const digits = digitsOf(sGeo, resolution);
  inverseShift(digits, rec.invertJ, rec.flipIJ);
  const v = packDigits(digits);
  return rec.reverse ? N - 1n - v : v;
}

// ---------- fractional point-location (ported verbatim from the original engine) ----------
// The old engine located a fractional point with a few sign tests per level
// (IJToQuaternary) — far cheaper than the L-system's per-level hull scan
// (~10-15x less work), and bit-identical by construction including its boundary
// tie-breaks. The resulting digit stream is the geometric (X/Y curve) digit
// stream, so the same inverseShift recode applies on top.

/**
 * Which of the 4 children contains the scaled offset, under the current flips
 * (the old engine's IJToQuaternary, verbatim).
 */
function ijToQuaternary(u: number, v: number, flips: [number, number]): number {
  // Boundaries to compare against
  const a = flips[0] === -1 ? -(u + v) : u + v;
  const b = flips[1] === -1 ? -u : u;
  const c = flips[0] === -1 ? -v : v;

  if (flips[0] + flips[1] === 0) {
    // Only one flip
    if (c < 1) return 0;
    if (b > 1) return 3;
    return a > 1 ? 2 : 1;
  }
  // No flips or both
  if (a < 1) return 0;
  if (b > 1) return 3;
  return c > 1 ? 2 : 1;
}

/**
 * Child anchor offsets in IJ units, indexed by [flip combination][digit]
 * (= the old engine's KJToIJ(quaternaryToKJ(digit, flips))).
 * Flip index = (flips[0] === YES) + 2 * (flips[1] === YES).
 */
// prettier-ignore
const CHILD_OFFSET_IJ: [number, number][][] = [
  [[0, 0], [1, 0], [0, 1], [1, 1]],     // (NO, NO):   p = k, q = j
  [[0, 0], [1, -1], [0, -1], [1, -2]],  // (YES, NO):  p = -j, q = -k
  [[0, 0], [-1, 1], [0, 1], [-1, 2]],   // (NO, YES):  p = j, q = k
  [[0, 0], [-1, 0], [0, -1], [-1, -1]]  // (YES, YES): p = -k, q = -j
];

/** Fractional IJ point -> old-curve position `s` of the containing cell. */
export function compatIJToS(ij: IJ, resolution: number, orientation: Orientation = 'uv'): bigint {
  const N = 1n << BigInt(2 * resolution);
  const rec = COMPAT_ORIENT[orientation];
  let i = ij[0],
    j = ij[1];
  if (rec.flipIJ) {
    const tmp = i;
    i = j;
    j = tmp;
  }
  if (rec.invertJ) {
    j = POW2[resolution] - (i + j);
  }

  // Geometric digits by direct point-location, most significant first.
  const digits: number[] = new Array(resolution);
  const flips: [number, number] = [1, 1];
  let pivotI = 0;
  let pivotJ = 0;
  for (let lvl = resolution - 1; lvl >= 0; lvl--) {
    const scale = 1 / POW2[lvl];
    const digit = ijToQuaternary((i - pivotI) * scale, (j - pivotJ) * scale, flips);
    digits[lvl] = digit;

    const fi = (flips[0] === -1 ? 1 : 0) + (flips[1] === -1 ? 2 : 0);
    const offset = CHILD_OFFSET_IJ[fi][digit];
    pivotI += offset[0] * POW2[lvl];
    pivotJ += offset[1] * POW2[lvl];
    applyDigitFlips(flips, digit);
  }

  inverseShift(digits, rec.invertJ, rec.flipIJ);
  const v = packDigits(digits);
  return rec.reverse ? N - 1n - v : v;
}

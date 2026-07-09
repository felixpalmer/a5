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
// (45k comparisons vs the pre-L-system build, zero differences). The compat
// fixtures (tests/fixtures/lattice/compat.json) pin this behavior.

import type {Orientation, Triple} from './types';
import type {IJ} from '../core/coordinate-systems';
import {compileGrammar, POW2} from './lsystem/tables';
import type {Cell} from './lsystem';
import {axiomLeafCell, axiomTargetToS, abToTriple, tripleToAB, a5TripleToFlavor} from './lsystem';

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

/** old s digits -> geometric (X/Y curve) digits, in place. LSB-first array. */
function forwardShift(digits: number[], invertJ: boolean, flipIJ: boolean): void {
  const pattern = flipIJ ? PATTERN_FLIPPED : PATTERN;
  const flips: [number, number] = [1, 1];
  for (let i = digits.length - 1; i >= 0; i--) {
    shiftDigits(digits, i, flips, invertJ, pattern);
    applyDigitFlips(flips, digits[i]);
  }
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
 * Old-curve position `s` -> triple coordinate, via the ORIGINAL (W/Z) forward
 * descent + shiftDigits recode. No flavor (that needs a second, A5, descent).
 */
export function compatSToTriple(s: bigint, resolution: number, orientation: Orientation = 'uv'): Triple {
  const N = 1n << BigInt(2 * resolution);
  const rec = COMPAT_ORIENT[orientation];
  const v = rec.reverse ? N - 1n - s : s;
  const digits = digitsOf(v, resolution);
  forwardShift(digits, rec.invertJ, rec.flipIJ);
  const raw = axiomLeafCell(ORIGINAL, packDigits(digits), resolution, AXIOM_W);
  let triple = abToTriple(raw.a, raw.b);
  if (rec.flipIJ) {
    triple = {x: triple.z, y: triple.y, z: triple.x};
  }
  if (rec.invertJ) {
    const n1 = POW2[resolution] - 1;
    triple = {x: triple.y - n1, y: triple.x + n1, z: triple.z};
  }
  return triple;
}

/** Old-curve position `s` -> cell (triple + pentagon flavor). */
export function compatSToCell(s: bigint, resolution: number, orientation: Orientation = 'uv'): Cell {
  const triple = compatSToTriple(s, resolution, orientation);
  // The X/Y walk hosts every cell via a diagonal (E/e) segment, so its leaf
  // state cannot distinguish all four pentagon flavors — that missing bit is
  // exactly why the original engine carried its fractal flips field. The
  // flavor is a per-cell geometric property, so read it off the A5 descent.
  return {triple, flavor: a5TripleToFlavor(triple, resolution)};
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
  const sGeo = axiomTargetToS(ORIGINAL, ab.a, ab.b, resolution, AXIOM_W, true)[0];
  const digits = digitsOf(sGeo, resolution);
  inverseShift(digits, rec.invertJ, rec.flipIJ);
  const v = packDigits(digits);
  return rec.reverse ? N - 1n - v : v;
}

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
  const sGeo = axiomTargetToS(ORIGINAL, 12 * (i + j), -12 * j, resolution, AXIOM_W, false)[0];
  const digits = digitsOf(sGeo, resolution);
  inverseShift(digits, rec.invertJ, rec.flipIJ);
  const v = packDigits(digits);
  return rec.reverse ? N - 1n - v : v;
}

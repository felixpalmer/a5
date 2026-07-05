// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// The turtle alphabet on the integer (a,b) triangular lattice (basis u=(√3/4,1/4),
// v=(0,1/2)). Draw symbols {E e S s U u D d T t} are unit segments; `+`/`-` are 60°
// turns. Each symbol also carries the 3 corners of the triangular cell it hosts.
// Everything here is exact integer — √3 only enters when (a,b) is later mapped to
// A5 triple coordinates (in lsystem.ts).

export interface AB {
  a: number;
  b: number;
}
export const add = (p: AB, q: AB): AB => ({a: p.a + q.a, b: p.b + q.b});
export const neg = (p: AB): AB => ({a: -p.a, b: -p.b}); // 180° rotation
const rot60 = (p: AB): AB => ({a: -p.b, b: p.a + p.b}); // 60° CCW, order 6
export const rotTimes = (p: AB, n: number): AB => {
  let r = p;
  const k = ((n % 6) + 6) % 6;
  for (let i = 0; i < k; i++) r = rot60(r);
  return r;
};

// Step vector of each draw symbol at heading 0. Lowercase = same step, cell hosted
// on the other side (see HOST_OFFSETS).
const BASE: Record<string, AB> = {
  E: {a: 4, b: 0}, e: {a: 4, b: 0},
  S: {a: 4, b: -2}, s: {a: 4, b: -2},
  U: {a: 0, b: 2}, u: {a: 0, b: 2},
  D: {a: 0, b: -2}, d: {a: 0, b: -2},
  T: {a: -4, b: 0}, t: {a: -4, b: 0}
};
export const DRAW = new Set(Object.keys(BASE));
// The 3 corner offsets (heading 0, from the segment start) of the cell each symbol hosts.
const HOST_OFFSETS: Record<string, [AB, AB, AB]> = {
  E: [{a: 0, b: 0}, {a: 4, b: 0}, {a: 4, b: -4}], e: [{a: 0, b: 0}, {a: 4, b: 0}, {a: 0, b: 4}],
  S: [{a: 0, b: 0}, {a: 4, b: 0}, {a: 4, b: -4}], s: [{a: 4, b: -2}, {a: 0, b: 2}, {a: 0, b: -2}],
  U: [{a: 0, b: 2}, {a: 0, b: -2}, {a: 4, b: -2}], u: [{a: 0, b: 0}, {a: 0, b: 4}, {a: -4, b: 4}],
  D: [{a: 0, b: 2}, {a: 0, b: -2}, {a: 4, b: -2}], d: [{a: 0, b: 0}, {a: 0, b: -4}, {a: -4, b: 0}],
  T: [{a: 0, b: -4}, {a: -4, b: 0}, {a: -4, b: -4}], t: [{a: -4, b: 4}, {a: 0, b: 0}, {a: 0, b: 4}]
};

/** The 3 (a,b) corners of the cell hosted by `sym`, drawn from `from` at `heading`. */
export function hostCorners(sym: string, from: AB, heading: number): [AB, AB, AB] {
  return HOST_OFFSETS[sym].map(o => add(from, rotTimes(o, heading))) as [AB, AB, AB];
}

/** The corner SUM (= 3·centroid, an exact integer) of that cell. */
export function hostSum(sym: string, from: AB, heading: number): AB {
  const [p, q, r] = hostCorners(sym, from, heading);
  return {a: p.a + q.a + r.a, b: p.b + q.b + r.b};
}

/**
 * Walk a draw string (draw symbols + `+`/`-` turns) from (pos, heading). Calls
 * `onDraw(sym, from, heading)` for each draw symbol (before advancing). Returns the
 * final turtle state.
 */
export function walk(
  s: string,
  pos: AB,
  heading: number,
  onDraw?: (sym: string, from: AB, heading: number) => void
): {pos: AB; heading: number} {
  let p = {...pos}, h = ((heading % 6) + 6) % 6;
  for (const ch of s) {
    if (ch === '+') { h = (h + 1) % 6; continue; }
    if (ch === '-') { h = (h + 5) % 6; continue; }
    if (!DRAW.has(ch)) continue;
    onDraw?.(ch, p, h);
    p = add(p, rotTimes(BASE[ch], h));
  }
  return {pos: p, heading: h};
}

/** Net (a,b) displacement + net heading of a draw string, from origin at heading 0. */
export function netOf(s: string): {disp: AB; dHeading: number} {
  const end = walk(s, {a: 0, b: 0}, 0);
  return {disp: end.pos, dHeading: end.heading};
}

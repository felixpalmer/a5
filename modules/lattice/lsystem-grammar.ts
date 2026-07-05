// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// The A5 curve's L-system grammar: the motif rules and the string operations that
// expand them. This file is the source of truth for the curve's definition and is
// purely symbolic — the turtle geometry that interprets the symbols lives in
// lsystem-turtle.ts, and the compilation to descent tables in lsystem-tables.ts.
//
// 7 self-referential motifs over the alphabet {A B C M P Q R} (+ their lowercase
// reverses) + the draw terminals {E e S s U u D d T t} + the 60° turns +/-.
// A LOWERCASE motif is its uppercase counterpart REVERSED, generated automatically
// by `reverseMotif` — so only the 7 uppercase rules below need to be authored.

/** Each motif's production rule (the 7 authored motifs). */
export const RULES: Record<string, string> = {
  A: 'PQAB',
  B: 'B+++PQ---A',
  C: 'P---RMb+++',
  M: 'qQ+++C---b',
  P: 'PpB---B+++',
  Q: 'PQ---Cb+++',
  R: 'b+++a---qQ'
};

/** Each motif's leaf draw symbol — the terminal it renders as at the base case. */
export const DRAWS: Record<string, string> = {A: 'E', B: '+e-', C: '-e+', M: 'T', P: 'S', Q: 'D', R: '+++D---'};

/** The authored (uppercase) motif keys. */
export const MOTIFS = Object.keys(RULES);

/** All motif keys, uppercase + their lowercase (reversed) counterparts. */
export const ALL_MOTIFS = [...MOTIFS, ...MOTIFS.map(m => m.toLowerCase())];

const swapCase = (c: string): string => (c >= 'a' && c <= 'z' ? c.toUpperCase() : c.toLowerCase());

/**
 * The reverse of a motif/draw string — traced end to start. Uniform transform:
 * reverse the order, swap the case of every letter (uppercase<->lowercase =
 * forward<->reverse partner), and flip every `+`/`-`. This is how the lowercase
 * motifs are derived from the authored uppercase rules.
 */
export const reverseMotif = (s: string): string =>
  [...s]
    .reverse()
    .map(c => (c === '+' ? '-' : c === '-' ? '+' : swapCase(c)))
    .join('');

/**
 * One expansion pass over `str`: replace each symbol using `table` (RULES or
 * DRAWS). A lowercase motif whose uppercase is in `table` expands to that rule
 * REVERSED; turns and unknown symbols pass through unchanged.
 */
export function expandOnce(str: string, table: Record<string, string>): string {
  let out = '';
  for (const ch of str) {
    const up = ch.toUpperCase();
    if (table[ch] !== undefined) out += table[ch];
    else if (ch !== up && table[up] !== undefined) out += reverseMotif(table[up]);
    else out += ch;
  }
  return out;
}

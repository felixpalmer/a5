// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// The canonical A5 curve is currently the ORIGINAL construction (compat.ts):
// the two-motif quaternary L-system with the shiftDigits recode on top, so
// cell IDs remain bit-identical to previous releases. The non-self-intersecting
// L-system curve (lsystem.ts / curve.ts) powers the machinery underneath and is
// fully implemented and pinned by fixtures (tests/lattice/lsystem.test.ts);
// making it canonical is a planned follow-up — a breaking change of all cell
// IDs that swaps the exports below to lsystem.ts/curve.ts and regenerates the
// fixtures.

export type {Orientation} from './types';

export {
  compatSToCell as sToCell,
  compatSToTriple as sToTriple,
  compatTripleToS as tripleToS,
  compatIJToS as IJToS
} from './compat';
export type {Cell} from './lsystem';

export type {Triple} from './triple';
export {tripleParity, tripleInBounds} from './triple';

// Also exported under their own names, so the old-curve behavior stays pinned
// explicitly (tests/lattice/compat.test.ts) across the future canonical swap.
export {compatSToCell, compatSToTriple, compatTripleToS, compatIJToS} from './compat';

// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// The canonical A5 curve is the ORIGINAL construction, now expressed on the
// L-system machinery (compat.ts) — bit-identical cell IDs, proven in
// tests/lattice/compat-equivalence.test.ts. The old engine below is no longer
// used by the library and is retired in a follow-up; the non-self-intersecting
// L-system curve (lsystem.ts / curve.ts) is pinned by fixtures and becomes
// canonical in a later, breaking change.

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

// ---- The original engine (unused by the library; retired in a follow-up) ----
export {YES, NO} from './types';
export type {Quaternary, Flip, Anchor} from './types';
export {IJToKJ, KJToIJ} from './basis';
export {quaternaryToKJ, quaternaryToFlips, IJToQuaternary} from './quaternary';
export {computeQ, offsetFlipsToAnchor} from './anchor';
export {shiftDigits, PATTERN, PATTERN_FLIPPED, PATTERN_REVERSED, PATTERN_FLIPPED_REVERSED} from './shift-digits';
export {sToAnchor, IJToFlips, anchorToS} from './hilbert';
export {anchorToTriple, tripleToAnchor} from './triple';

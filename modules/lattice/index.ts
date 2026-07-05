// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

export {YES, NO} from './types';
export type {Orientation, Quaternary, Flip, Anchor} from './types';

export {IJToKJ, KJToIJ} from './basis';

export {quaternaryToKJ, quaternaryToFlips, IJToQuaternary} from './quaternary';

export {computeQ, offsetFlipsToAnchor} from './anchor';

export {shiftDigits, PATTERN, PATTERN_FLIPPED, PATTERN_REVERSED, PATTERN_FLIPPED_REVERSED} from './shift-digits';

export {sToAnchor, IJToS, IJToFlips, anchorToS} from './hilbert';

export type {Triple} from './triple';
export {tripleParity, tripleInBounds, tripleToS, anchorToTriple, tripleToAnchor} from './triple';

// The canonical curve, expressed on the L-system machinery — bit-for-bit
// identical to the engine above (proven in tests/lattice/compat-equivalence.test.ts).
// A follow-up rewires the canonical exports to these and retires the old engine.
export {compatSToCell, compatSToTriple, compatTripleToS, compatIJToS} from './compat';

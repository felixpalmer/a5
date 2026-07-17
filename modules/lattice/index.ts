// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// The canonical A5 curve is the non-self-intersecting L-system curve
// (lsystem/ + curve.ts): point -> s via IJToS, and the s <-> cell mappings via
// sToCell / sToTriple / tripleToS. This is a breaking change from previous
// releases — cell IDs differ from the original construction. The original curve
// remains available bit-for-bit via the compat* exports below for migration.

export type {Orientation} from './types';

export {IJToS, roundToTriple} from './curve';
export {sToCell, sToTriple} from './lsystem';
export type {Cell} from './lsystem';

export type {Triple} from './triple';
export {tripleParity, tripleInBounds, tripleFlavor, tripleToS} from './triple';

// The ORIGINAL (pre-L-system) curve, bit-for-bit, for the migration path —
// same cells, same pentagon flavors, old visiting order (tests/lattice/compat.test.ts).
export {compatSToCell, compatSToTriple, compatTripleToS, compatIJToS} from './compat';

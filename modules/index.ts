// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {glMatrix} from 'gl-matrix';
glMatrix.setMatrixArrayType(Float64Array as any);

// PUBLIC API
// Indexing
export {cellToBoundary, cellToLonLat, lonLatToCell} from './core/cell';
export {hexToBigInt, bigIntToHex} from './core/hex';

// Hierarchy
export {cellToParent, cellToChildren, getResolution} from './core/serialization';

// Types
export type {Degrees, Radians} from './core/coordinate-systems';
export type {A5Cell} from './core/utils';
// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {glMatrix} from 'gl-matrix';
glMatrix.setMatrixArrayType(Float64Array as any);

// PUBLIC API
// Indexing
export {cellToBoundary, cellToLonLat, lonLatToCell} from './core/cell';
export {hexToU64, u64ToHex} from './core/hex';

// Hierarchy
export {cellToParent, cellToChildren, getResolution, getRes0Cells, WORLD_CELL} from './core/serialization';
export {getNumCells, cellArea} from './core/cell-info';
export {compact, uncompact} from './core/compact';

// Types
export type {Degrees, Radians} from './core/coordinate-systems';
export type {A5Cell} from './core/utils';
// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {glMatrix} from 'gl-matrix';
glMatrix.setMatrixArrayType(Float64Array as any);

// PUBLIC API
// Indexing
// Spherical (theta/phi) is A5's internal coordinate system; cellToSpherical /
// sphericalToCell are not part of the public API and stay module-internal.
export {cellToBoundary, cellToLonLat, lonLatToCell} from './core/cell';
export {hexToU64, u64ToHex} from './core/hex';

// Hierarchy
export {
  cellToParent,
  cellToChildren,
  getResolution,
  getRes0Cells,
  MAX_RESOLUTION,
  WORLD_CELL
} from './core/serialization';
export {getNumCells, getNumChildren, cellArea} from './core/cell-info';
export {compact, uncompact} from './core/compact';

// Traversal
export {gridDisk, gridDiskVertex} from './traversal/grid-disk';
export {sphericalCap} from './traversal/cap';
export {lineStringToCells} from './traversal/line';

// Regions
export {polygonToCells} from './regions/polygon';

// Types
export type {Degrees, Radians} from './core/coordinate-systems';
export type {A5Cell} from './core/utils';

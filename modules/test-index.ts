// A5 Test Bundle
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// Export projections for testing
export { GnomonicProjection } from './projections/gnomonic';
export { AuthalicProjection } from './projections/authalic';
export { DodecahedronProjection } from './projections/dodecahedron';
export { PolyhedralProjection } from './projections/polyhedral';
export { CRS } from './projections/crs';

// Export core types needed for projections
export type { Polar, Spherical } from './core/coordinate-systems'; 
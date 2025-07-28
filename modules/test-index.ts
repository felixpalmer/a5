// A5 Test Bundle
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// Re-export public API
export * from './index';

export {origins} from './core/origin';

// Export projections for testing
export { GnomonicProjection } from './projections/gnomonic';
export { AuthalicProjection } from './projections/authalic';
export { DodecahedronProjection } from './projections/dodecahedron';
export { PolyhedralProjection } from './projections/polyhedral';
export { CRS } from './projections/crs';

// Export geometry classes for testing
export { SphericalPolygonShape } from './geometry/spherical-polygon';
export { SphericalTriangleShape } from './geometry/spherical-triangle';
export { PentagonShape } from './geometry/pentagon';

// Export core types needed for projections
export type { Polar, Spherical } from './core/coordinate-systems'; 
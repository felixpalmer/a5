// A5 Test Bundle
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// Re-export public API
export * from './index';

export {origins} from './core/origin';
export {serialize, WORLD_CELL} from './core/serialization';

// Export naive implementations for benchmarking
export {compact as compactNaive, uncompact as uncompactNaive} from './core/compact.naive';
export {compact as compactOptimized, uncompact as uncompactOptimized, _compact} from './core/compact';
export {quaternions} from './core/dodecahedron-quaternions';
export {
  φ,
  TWO_PI,
  TWO_PI_OVER_5,
  PI_OVER_5,
  PI_OVER_10,
  dihedralAngle,
  interhedralAngle,
  faceEdgeAngle,
  distanceToEdge,
  distanceToVertex,
  Rinscribed,
  Rmidedge,
  Rcircumscribed
} from './core/constants';

// Export tiling functions for testing
export { getPentagonVertices, getQuintantVertices, getFaceVertices, getQuintantPolar } from './core/tiling';

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
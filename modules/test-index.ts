// A5 Test Bundle
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// Re-export public API
export * from './index';

export {origins, segmentToQuintant, quintantToSegment, haversine} from './core/origin';
export {serialize, deserialize, WORLD_CELL, FIRST_HILBERT_RESOLUTION} from './core/serialization';
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
export { isNeighbor } from './traversal/neighbors'

// Export Hilbert functions for testing
export { sToAnchor, anchorToS, IJToKJ, IJToS, computeQ, offsetFlipsToAnchor, shiftDigits, IJToQuaternary, quaternaryToKJ, quaternaryToFlips } from './lattice';
export { tripleParity, tripleInBounds, tripleToS, anchorToTriple, tripleToAnchor } from './lattice';
export type { Anchor, Triple } from './lattice';

// Export neighbor functions for testing
export { getCellNeighbors } from './traversal/quintant-neighbors';
export { getGlobalCellNeighbors } from './traversal/global-neighbors';

// Export cap helper functions for testing
export { metersToH, estimateCellRadius, pickCoarseResolution } from './traversal/cap';

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
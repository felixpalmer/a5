// A5 Test Bundle
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// Re-export public API
export * from './index';

export {origins, segmentToQuintant, quintantToSegment, haversine} from './core/origin';
export {cellToSpherical} from './core/cell';
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
export {getPentagonVertices, getQuintantVertices, getFaceVertices, getQuintantPolar} from './core/tiling';
export {NEIGHBOR_DELTAS} from './traversal/neighbors';

// Export curve / lattice functions for testing
export {roundToTriple, sToCell, sToTriple, tripleParity, tripleInBounds, tripleToS} from './lattice';
export {compatSToCell, compatSToTriple, compatTripleToS, compatIJToS} from './lattice';
export type {Cell, Triple} from './lattice';

// The non-self-intersecting L-system curve — the planned future canonical
// curve (breaking change) — exported explicitly so it stays pinned by fixtures
export {
  sToCell as lsystemSToCell,
  sToTriple as lsystemSToTriple,
  tripleToSLattice as lsystemTripleToS
} from './lattice/lsystem';

// Export neighbor functions for testing
export {getCellNeighbors} from './traversal/quintant-neighbors';
export {getGlobalCellNeighbors} from './traversal/global-neighbors';

// Export cap helper functions for testing
export {metersToH, estimateCellRadius, pickCoarseResolution} from './traversal/cap';

// Export great-circle helpers for testing
export {greatCircleDistance, sampleGreatCircleArc} from './utils/great-circle';

// Export lattice neighbor / flood-fill for testing
export {getLatticeNeighbors} from './traversal/lattice-neighbors';
export {tripleSpaceFloodFill} from './traversal/lattice-flood-fill';

// Export spherical-polygon free functions for testing
export {pointInSphericalPolygon, ringWindingSign, ringSegmentNormals} from './geometry/spherical-polygon';

// Export projections for testing
export {GnomonicProjection} from './projections/gnomonic';
export {AuthalicProjection} from './projections/authalic';
export {DodecahedronProjection} from './projections/dodecahedron';
export {EqualAreaProjection} from './projections/equal-area';
export {CRS} from './projections/crs';

// Export geometry classes for testing
export {SphericalPolygonShape} from './geometry/spherical-polygon';
export {SphericalTriangleShape} from './geometry/spherical-triangle';
export {PentagonShape} from './geometry/pentagon';

// Export core types needed for projections
export type {Polar, Spherical} from './core/coordinate-systems';

// Export coordinate transforms for fixture generation
export {fromLonLat, toCartesian, toSpherical, toLonLat} from './core/coordinate-transforms';

const path = require("path");

// Core tests
require("./fixtures/core/serialization.cjs");
require("./fixtures/core/cell-info.cjs");
require("./fixtures/core/crs-vertices.cjs");
require("./fixtures/core/origins.cjs");
require("./fixtures/core/tiling.cjs");
require("./fixtures/core/constants.cjs");
require("./fixtures/core/dodecahedron-quaternions.cjs");
// Lattice generators
require("./fixtures/lattice/hilbert.cjs");
require("./fixtures/lattice/shift-digits.cjs");
require("./fixtures/lattice/quaternary.cjs");
require("./fixtures/lattice/triple.cjs");

// Traversal generators
require("./fixtures/traversal/quintant-neighbors.cjs");
require("./fixtures/traversal/global-neighbors.cjs");
require("./fixtures/traversal/grid-disk.cjs");
require("./fixtures/traversal/cap.cjs");
require("./fixtures/core/compact.cjs");

// Geometry generators
require("./fixtures/geometry/spherical-polygon.cjs");
require("./fixtures/geometry/spherical-triangle.cjs");
require("./fixtures/geometry/pentagon.cjs");

// Projection generators
require("./fixtures/projections/gnomonic.cjs");
require("./fixtures/projections/authalic.cjs");
require("./fixtures/projections/polyhedral.cjs");
require("./fixtures/projections/dodecahedron.cjs");

// Integration tests
require("./generate-wireframe-tests.cjs");

console.log("All fixtures generated successfully!"); 

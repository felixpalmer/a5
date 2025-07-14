const path = require("path");

// Core tests
require("./fixtures/core/cell-info.cjs");

// Projection generators
require("./fixtures/projections/gnomonic.cjs");
require("./fixtures/projections/authalic.cjs");
require("./fixtures/projections/polyhedral.cjs");
require("./fixtures/projections/dodecahedron.cjs");

// Integration tests
require("./generate-wireframe-tests.cjs");

console.log("All projection fixtures generated successfully!"); 

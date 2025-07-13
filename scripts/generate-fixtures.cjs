const path = require("path");

// Import all projection generators
require("./fixtures/projections/gnomonic.cjs");
require("./fixtures/projections/authalic.cjs");
require("./fixtures/projections/polyhedral.cjs");

console.log("All projection fixtures generated successfully!"); 
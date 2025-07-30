const fs = require('fs');
const path = require('path');

const { CRS } = require('../../a5-test.cjs');

// Generate CRS vertices data
const crs = new CRS();
const crsVertices = crs['vertices']; // Access private vertices property

// Convert vertices to plain arrays for JSON serialization
const verticesData = crsVertices.map(vertex => [vertex[0], vertex[1], vertex[2]]);

// Save the data to a JSON file
const fixturesDir = path.join(__dirname, './../../../tests/fixtures');
const outputPath = path.join(fixturesDir, 'crs-vertices.json');
fs.writeFileSync(outputPath, JSON.stringify(verticesData, null, 2));

console.log(`Generated CRS vertices fixture with ${verticesData.length} vertices`);
console.log(`Saved to: ${outputPath}`); 
const fs = require('fs');
const path = require('path');

/**
 * Generic test generator for geometry classes
 * @param {Object} config - Configuration object for the geometry
 * @param {string} config.name - Name of the geometry (e.g., 'pentagon', 'spherical-polygon')
 * @param {Function} config.GeometryClass - Constructor function for the geometry class
 * @param {Function} config.generateRandomInput - Function to generate random input vertices
 * @param {Function} config.generateTestPoints - Function to generate test points for containsPoint tests
 * @param {Object} config.computeExpected - Object containing functions to compute expected values
 * @param {number} config.vertexCount - Number of vertices for this geometry type
 * @param {number} config.count - Number of test cases to generate (default: 10)
 */
function generateGeometryFixtures(config) {
  const {
    name,
    GeometryClass,
    generateRandomInput,
    generateTestPoints,
    computeExpected,
    vertexCount,
    count = 10
  } = config;

  const outputDir = path.join(__dirname, './../../tests/geometry/fixtures');
  const outputPath = path.join(outputDir, `${name}.json`);
  
  let fixtures = [];
  let existingFixtures = [];
  
  // Try to read existing fixtures
  if (fs.existsSync(outputPath)) {
    console.log(`Reading existing ${name} fixtures...`);
    existingFixtures = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    fixtures = [...existingFixtures];
  }
  
  // Generate new fixtures if needed and update data
  for (let i = 0; i < count; i++) {
    const existingFixture = fixtures[i];
    const vertices = existingFixture.vertices || generateRandomInput(vertexCount);
    const geometry = new GeometryClass(vertices);
    const testPoints = existingFixture ? existingFixture.containsPointTests.map(p => p.point) : generateTestPoints(geometry);
    
    fixtures[i] = {
      vertices,
      ...computeExpected(geometry, testPoints)
    };
  }

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(fixtures, null, 2));
  console.log(`Generated ${fixtures.length} ${name} fixtures at: ${outputPath}`);

  return fixtures;
}

module.exports = {
  generateGeometryFixtures
}; 
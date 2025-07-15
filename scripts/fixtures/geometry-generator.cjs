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
  
  // Try to read existing fixtures
  if (fs.existsSync(outputPath)) {
    console.log(`Reading existing ${name} fixtures...`);
    fixtures = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  }
  
  // If no existing fixtures, generate new ones
  if (fixtures.length === 0) {
    console.log(`Generating new ${name} fixtures...`);
    for (let i = 0; i < count; i++) {
      const vertices = generateRandomInput(vertexCount);
      fixtures.push({ vertices });
    }
  }

  // Update computed values for each fixture
  fixtures = fixtures.map(fixture => {
    const geometry = new GeometryClass(fixture.vertices);
    const testPoints = generateTestPoints(geometry);
    
    const result = {
      vertices: fixture.vertices,
      ...computeExpected(geometry, testPoints)
    };

    return result;
  });

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
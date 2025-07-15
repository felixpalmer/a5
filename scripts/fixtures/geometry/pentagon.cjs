const fs = require('fs');
const path = require('path');
const { PentagonShape } = require('../../a5-test.cjs');

function generateRandomFace() {
  // Generate random 2D point
  const x = (Math.random() - 0.5) * 4;
  const y = (Math.random() - 0.5) * 4;
  return [x, y];
}

function generateRandomPentagon() {
  const vertices = [];
  for (let i = 0; i < 5; i++) {
    vertices.push(generateRandomFace());
  }
  return vertices;
}

function generatePentagonFixtures() {
  const fixtures = [];

  // Generate 10 different pentagon instances
  for (let i = 0; i < 10; i++) {
    const vertices = generateRandomPentagon();
    const pentagon = new PentagonShape(vertices);

    // Test points for containsPoint
    const center = pentagon.getCenter();
    const testPoints = [
      center, // Center point
      [center[0] + 0.1, center[1] + 0.1], // Slightly offset from center
      [center[0] + 2, center[1] + 2], // Clearly outside
      [center[0] - 2, center[1] - 2], // Clearly outside
      generateRandomFace() // Random point
    ];

    const fixture = {
      vertices: vertices,
      area: pentagon.getArea(),
      center: pentagon.getCenter(),
      containsPointTests: testPoints.map(point => ({
        point: point,
        result: pentagon.containsPoint(point)
      })),
      transformTests: {
        scale: pentagon.clone().scale(2).getVertices(),
        rotate180: pentagon.clone().rotate180().getVertices(),
        reflectY: pentagon.clone().reflectY().getVertices(),
        translate: pentagon.clone().translate([1, 1]).getVertices()
      },
      splitEdgesTests: {
        segments2: pentagon.clone().splitEdges(2).getVertices(),
        segments3: pentagon.clone().splitEdges(3).getVertices()
      }
    };

    fixtures.push(fixture);
  }

  return fixtures;
}

// Generate and save fixtures
const fixtures = generatePentagonFixtures();
const outputDir = path.join(__dirname, '../../../modules/geometry/__tests__/fixtures');
const outputPath = path.join(outputDir, 'pentagon.json');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputPath, JSON.stringify(fixtures, null, 2));
console.log(`Generated ${fixtures.length} pentagon fixtures at: ${outputPath}`); 
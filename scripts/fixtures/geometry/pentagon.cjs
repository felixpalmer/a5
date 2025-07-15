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
  const outputDir = path.join(__dirname, './../../../tests/geometry/fixtures');
  const outputPath = path.join(outputDir, 'pentagon.json');
  
  let fixtures = [];
  
  // Try to read existing fixtures
  if (fs.existsSync(outputPath)) {
    fixtures = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  }
  
  // If no existing fixtures, generate new ones
  if (fixtures.length === 0) {
    // Generate 10 different pentagon instances
    for (let i = 0; i < 10; i++) {
      const vertices = generateRandomPentagon();
      fixtures.push({ vertices });
    }
  }

  // Update computed values for each fixture
  fixtures = fixtures.map(fixture => {
    const pentagon = new PentagonShape(fixture.vertices);

    // Test points for containsPoint
    const center = pentagon.getCenter();
    const testPoints = [
      center, // Center point
      [center[0] + 0.1, center[1] + 0.1], // Slightly offset from center
      [center[0] + 2, center[1] + 2], // Clearly outside
      [center[0] - 2, center[1] - 2], // Clearly outside
      generateRandomFace() // Random point
    ];

    return {
      vertices: fixture.vertices,
      area: pentagon.getArea(),
      center: [...pentagon.getCenter()],
      containsPointTests: testPoints.map(point => ({
        point: [...point],
        result: pentagon.containsPoint(point)
      })),
      transformTests: {
        scale: pentagon.clone().scale(2).getVertices().map(v => [...v]),
        rotate180: pentagon.clone().rotate180().getVertices().map(v => [...v]),
        reflectY: pentagon.clone().reflectY().getVertices().map(v => [...v]),
        translate: pentagon.clone().translate([1, 1]).getVertices().map(v => [...v])
      },
      splitEdgesTests: {
        segments2: pentagon.clone().splitEdges(2).getVertices().map(v => [...v]),
        segments3: pentagon.clone().splitEdges(3).getVertices().map(v => [...v])
      }
    };
  });

  return fixtures;
}

// Generate and save fixtures
const fixtures = generatePentagonFixtures();
const outputDir = path.join(__dirname, './../../../tests/geometry/fixtures');
const outputPath = path.join(outputDir, 'pentagon.json');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputPath, JSON.stringify(fixtures, null, 2));
console.log(`Generated ${fixtures.length} pentagon fixtures at: ${outputPath}`); 
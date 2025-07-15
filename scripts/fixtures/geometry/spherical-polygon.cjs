const fs = require('fs');
const path = require('path');
const { SphericalPolygonShape } = require('../../a5-test.cjs');

function generateRandomCartesian() {
  // Generate random unit vector
  const x = (Math.random() - 0.5) * 2;
  const y = (Math.random() - 0.5) * 2;
  const z = (Math.random() - 0.5) * 2;
  const length = Math.sqrt(x * x + y * y + z * z);
  return [x / length, y / length, z / length];
}

function generateRandomPolygon(vertexCount) {
  const vertices = [];
  for (let i = 0; i < vertexCount; i++) {
    vertices.push(generateRandomCartesian());
  }
  return vertices;
}

function generateSphericalPolygonFixtures() {
  const outputDir = path.join(__dirname, './../../../tests/geometry/fixtures');
  const outputPath = path.join(outputDir, 'spherical-polygon.json');
  
  let fixtures = [];
  
  // Try to read existing fixtures
  if (fs.existsSync(outputPath)) {
    fixtures = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  }
  
  // If no existing fixtures, generate new ones
  if (fixtures.length === 0) {
    // Generate 10 different polygon instances
    for (let i = 0; i < 10; i++) {
      const vertexCount = 5;
      const vertices = generateRandomPolygon(vertexCount);
      fixtures.push({ vertices });
    }
  }

  // Update computed values for each fixture
  fixtures = fixtures.map(fixture => {
    const polygon = new SphericalPolygonShape(fixture.vertices);

    // Test points for containsPoint
    const testPoints = [
      polygon.slerp(0.5), // Point on edge
      [0, 0, 1], // North pole
      [0, 0, -1], // South pole
      generateRandomCartesian(), // Random point
      generateRandomCartesian()  // Another random point
    ];

    return {
      vertices: fixture.vertices,
      area: polygon.getArea(),
      boundary1: polygon.getBoundary(1, true).map(p => [...p]),
      boundary2: polygon.getBoundary(2, true).map(p => [...p]),
      boundary3: polygon.getBoundary(3, true).map(p => [...p]),
      slerpTests: [
        { t: 0, result: [...polygon.slerp(0)] },
        { t: 0.25, result: [...polygon.slerp(0.25)] },
        { t: 0.5, result: [...polygon.slerp(0.5)] },
        { t: 0.75, result: [...polygon.slerp(0.75)] },
        { t: 1.0, result: [...polygon.slerp(1.0)] },
        { t: 1.5, result: [...polygon.slerp(1.5)] }
      ],
      containsPointTests: testPoints.map(point => ({
        point: [...point],
        result: polygon.containsPoint(point)
      }))
    };
  });

  return fixtures;
}

// Generate and save fixtures
const fixtures = generateSphericalPolygonFixtures();
const outputDir = path.join(__dirname, './../../../tests/geometry/fixtures');
const outputPath = path.join(outputDir, 'spherical-polygon.json');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputPath, JSON.stringify(fixtures, null, 2));
console.log(`Generated ${fixtures.length} spherical polygon fixtures at: ${outputPath}`); 
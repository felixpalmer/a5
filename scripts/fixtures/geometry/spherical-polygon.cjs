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
  const fixtures = [];

  // Generate 10 different polygon instances
  for (let i = 0; i < 10; i++) {
    const vertexCount = Math.floor(Math.random() * 5) + 3; // 3-7 vertices
    const vertices = generateRandomPolygon(vertexCount);
    const polygon = new SphericalPolygonShape(vertices);

    // Test points for containsPoint
    const testPoints = [
      polygon.slerp(0.5), // Point on edge
      [0, 0, 1], // North pole
      [0, 0, -1], // South pole
      generateRandomCartesian(), // Random point
      generateRandomCartesian()  // Another random point
    ];

    const fixture = {
      vertices: vertices,
      area: polygon.getArea(),
      boundary1: polygon.getBoundary(1, true),
      boundary2: polygon.getBoundary(2, true),
      boundary3: polygon.getBoundary(3, true),
      slerpTests: [
        { t: 0, result: polygon.slerp(0) },
        { t: 0.25, result: polygon.slerp(0.25) },
        { t: 0.5, result: polygon.slerp(0.5) },
        { t: 0.75, result: polygon.slerp(0.75) },
        { t: 1.0, result: polygon.slerp(1.0) },
        { t: 1.5, result: polygon.slerp(1.5) }
      ],
      containsPointTests: testPoints.map(point => ({
        point: [...point],
        result: polygon.containsPoint(point)
      }))
    };

    fixtures.push(fixture);
  }

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
const fs = require('fs');
const path = require('path');
const { SphericalTriangleShape } = require('../../a5-test.cjs');

function generateRandomCartesian() {
  // Generate random unit vector
  const x = (Math.random() - 0.5) * 2;
  const y = (Math.random() - 0.5) * 2;
  const z = (Math.random() - 0.5) * 2;
  const length = Math.sqrt(x * x + y * y + z * z);
  return [x / length, y / length, z / length];
}

function generateRandomTriangle() {
  const vertices = [];
  for (let i = 0; i < 3; i++) {
    vertices.push(generateRandomCartesian());
  }
  return vertices;
}

function generateSphericalTriangleFixtures() {
  const outputDir = path.join(__dirname, './../../../tests/geometry/fixtures');
  const outputPath = path.join(outputDir, 'spherical-triangle.json');
  
  let fixtures = [];
  
  // Try to read existing fixtures
  if (fs.existsSync(outputPath)) {
    fixtures = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  }
  
  // If no existing fixtures, generate new ones
  if (fixtures.length === 0) {
    // Generate 10 different triangle instances
    for (let i = 0; i < 10; i++) {
      const vertices = generateRandomTriangle();
      fixtures.push({ vertices });
    }
  }

  // Update computed values for each fixture
  fixtures = fixtures.map(fixture => {
    const triangle = new SphericalTriangleShape(fixture.vertices);

    // Test points for containsPoint
    const testPoints = [
      triangle.slerp(0.5), // Point on edge
      [0, 0, 1], // North pole
      [0, 0, -1], // South pole
      generateRandomCartesian(), // Random point
      generateRandomCartesian()  // Another random point
    ];

    return {
      vertices: fixture.vertices,
      area: triangle.getArea(),
      boundary1: triangle.getBoundary(1, true).map(p => [...p]),
      boundary2: triangle.getBoundary(2, true).map(p => [...p]),
      boundary3: triangle.getBoundary(3, true).map(p => [...p]),
      slerpTests: [
        { t: 0, result: [...triangle.slerp(0)] },
        { t: 0.25, result: [...triangle.slerp(0.25)] },
        { t: 0.5, result: [...triangle.slerp(0.5)] },
        { t: 0.75, result: [...triangle.slerp(0.75)] },
        { t: 1.0, result: [...triangle.slerp(1.0)] },
        { t: 1.5, result: [...triangle.slerp(1.5)] }
      ],
      containsPointTests: testPoints.map(point => ({
        point: [...point],
        result: triangle.containsPoint(point)
      }))
    };
  });

  return fixtures;
}

// Generate and save fixtures
const fixtures = generateSphericalTriangleFixtures();
const outputDir = path.join(__dirname, './../../../tests/geometry/fixtures');
const outputPath = path.join(outputDir, 'spherical-triangle.json');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputPath, JSON.stringify(fixtures, null, 2));
console.log(`Generated ${fixtures.length} spherical triangle fixtures at: ${outputPath}`); 
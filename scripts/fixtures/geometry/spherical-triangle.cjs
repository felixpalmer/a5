const { SphericalTriangleShape } = require('../../a5-test.cjs');
const { generateGeometryFixtures } = require('../geometry-generator.cjs');

function generateRandomCartesian() {
  // Generate random unit vector
  const x = (Math.random() - 0.5) * 2;
  const y = (Math.random() - 0.5) * 2;
  const z = (Math.random() - 0.5) * 2;
  const length = Math.sqrt(x * x + y * y + z * z);
  return [x / length, y / length, z / length];
}

function generateRandomInput(vertexCount) {
  const vertices = [];
  for (let i = 0; i < vertexCount; i++) {
    vertices.push(generateRandomCartesian());
  }
  return vertices;
}

function generateTestPoints(triangle) {
  return [
    triangle.slerp(0.5), // Point on edge
    [0, 0, 1], // North pole
    [0, 0, -1], // South pole
    generateRandomCartesian(), // Random point
    generateRandomCartesian()  // Another random point
  ];
}

function computeExpected(triangle, testPoints) {
  return {
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
}

// Generate fixtures
generateGeometryFixtures({
  name: 'spherical-triangle',
  GeometryClass: SphericalTriangleShape,
  generateRandomInput,
  generateTestPoints,
  computeExpected,
  vertexCount: 3
}); 
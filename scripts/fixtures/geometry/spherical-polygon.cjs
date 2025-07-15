const { SphericalPolygonShape } = require('../../a5-test.cjs');
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

function generateTestPoints(polygon) {
  return [
    polygon.slerp(0.5), // Point on edge
    [0, 0, 1], // North pole
    [0, 0, -1], // South pole
    generateRandomCartesian(), // Random point
    generateRandomCartesian()  // Another random point
  ];
}

function computeExpected(polygon, testPoints) {
  return {
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
}

// Generate fixtures
generateGeometryFixtures({
  name: 'spherical-polygon',
  GeometryClass: SphericalPolygonShape,
  generateRandomInput,
  generateTestPoints,
  computeExpected,
  vertexCount: 5
}); 
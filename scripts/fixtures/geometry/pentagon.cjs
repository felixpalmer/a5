const { PentagonShape } = require('../../a5-test.cjs');
const { generateGeometryFixtures } = require('../geometry-generator.cjs');

function generateRandomFace() {
  // Generate random 2D point
  const x = (Math.random() - 0.5) * 4;
  const y = (Math.random() - 0.5) * 4;
  return [x, y];
}

function generateRandomInput(vertexCount) {
  const vertices = [];
  for (let i = 0; i < vertexCount; i++) {
    vertices.push(generateRandomFace());
  }
  return vertices;
}

function generateTestPoints(pentagon) {
  const center = pentagon.getCenter();
  return [
    center, // Center point
    [center[0] + 0.1, center[1] + 0.1], // Slightly offset from center
    [center[0] + 2, center[1] + 2], // Clearly outside
    [center[0] - 2, center[1] - 2], // Clearly outside
    generateRandomFace() // Random point
  ];
}

function computeExpected(pentagon, testPoints) {
  return {
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
}

// Generate fixtures
generateGeometryFixtures({
  name: 'pentagon',
  GeometryClass: PentagonShape,
  generateRandomInput,
  generateTestPoints,
  computeExpected,
  vertexCount: 5
}); 
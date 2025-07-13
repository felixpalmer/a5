const { DodecahedronProjection } = require("../../a5-test.cjs");
const { generateProjectionTests } = require("../projection-generator.cjs");

// Hardcoded originId for testing
const ORIGIN_ID = 0;

function generateRandomSphericalPoint() {
  const theta = (Math.random() - 0.5) * Math.PI;
  const phi = Math.random() *  Math.PI / 6; // Limit for now (origin 0)
  return [theta, phi];
}

// Copied from constants.ts
const distanceToEdge = (Math.sqrt(5) - 1) / 2; // φ - 1;
const distanceToVertex = 3 - Math.sqrt(5);

function generateRandomPointInPentagon() {
  const n = 10 * Math.random(); // which of the 10 triangles making up pentagon are we in
  const theta = Math.PI * n / 5;

  // Interpolate between distance to edge and distance to vertex
  const f = 1 - Math.abs(n % 2 - 1); // f:0 on edge, 1 on vertex
  const maxD = distanceToEdge / Math.cos(f * Math.PI / 5);
  const d = maxD * Math.random();
  const x = d * Math.cos(theta);
  const y = d * Math.sin(theta);
  return [x, y];
}

// Custom configuration for dodecahedron projection
const config = {
  projectionName: 'dodecahedron',
  ProjectionClass: DodecahedronProjection,
  generateRandomForwardInput: generateRandomSphericalPoint,
  generateRandomInverseInput: generateRandomPointInPentagon,
  forwardTestCount: 100,
  inverseTestCount: 100,
  forwardParams: [ORIGIN_ID],
  inverseParams: [ORIGIN_ID],
  postGenerate: (testData) => {
    testData.static = {
      ORIGIN_ID
    };
    return testData;
  }
};

generateProjectionTests(config); 
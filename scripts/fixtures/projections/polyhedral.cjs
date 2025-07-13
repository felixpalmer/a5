const { PolyhedralProjection } = require("../../a5-test.cjs");
const { generateProjectionTests } = require("../projection-generator.cjs");
const { vec3 } = require("gl-matrix");

// Static test data that must be included
const φ = (1 + Math.sqrt(5)) / 2;

// Spherical triangle for testing
const CENTER = [0, 0, 1];
const VERTEX = [(φ - 1) / Math.cos(Math.PI / 5), φ - 1, 1];
const EDGE_MIDPOINT = [0, φ - 1, 1];
const TEST_SPHERICAL_TRIANGLE = [CENTER, VERTEX, EDGE_MIDPOINT];

// Project to sphere
TEST_SPHERICAL_TRIANGLE.forEach(p => vec3.normalize(p, p));

// Different to shape used in app, but should not matter as barycentric coordinates are used
const TEST_FACE_TRIANGLE = [[0, 0], [0, 1], [1, 0]];

const range = Array.from({length: 10}).map((_, i) => Math.pow(0.1, i + 1)); // 0.1, 0.01, 0.001...

// Specific test points from the original test data
const SPECIFIC_FACE_POINTS = [
  // Vertices
  ...TEST_FACE_TRIANGLE,

  // Difficult points near 0,0
  ...range.map(n => [0, n]),
  ...range.map(n => [n, 0]),
  ...range.map(n => [n, n]),

  // Difficult points near 0,1
  ...range.map(n => [0, 1 - n]),
  ...range.map(n => [n, 1 - n]),

  // Difficult points near 1,0
  ...range.map(n => [1 - n, 0]),
  ...range.map(n => [1 - n, n])
];

function generateRandomFacePoint() {
  const x = Math.random();
  const y = (1 - x) * Math.random();
  return [x, y];
}

const polyhedral = new PolyhedralProjection();
function generateRandomSphericalPoint() {
  return polyhedral.inverse(generateRandomFacePoint(), TEST_FACE_TRIANGLE, TEST_SPHERICAL_TRIANGLE);
}

// Custom configuration for polyhedral projection
const config = {
  projectionName: 'polyhedral',
  ProjectionClass: PolyhedralProjection,
  generateRandomForwardInput: generateRandomSphericalPoint,
  generateRandomInverseInput: generateRandomFacePoint,
  specificInverseInputs: SPECIFIC_FACE_POINTS,
  forwardTestCount: 200,
  inverseTestCount: 200,
  forwardParams: [TEST_SPHERICAL_TRIANGLE, TEST_FACE_TRIANGLE],
  inverseParams: [TEST_FACE_TRIANGLE, TEST_SPHERICAL_TRIANGLE],
  postGenerate: (testData) => {
    testData.static = {
      TEST_SPHERICAL_TRIANGLE,
      TEST_FACE_TRIANGLE
    };
    return testData;
  }
};

generateProjectionTests(config); 
const {EqualAreaProjection, CRS} = require('../../a5-test.cjs');
const {generateProjectionTests} = require('../projection-generator.cjs');

// The projection's shape constants are bound to the dodecahedron's canonical
// face triangle, so the test triangle must be (congruent to) it. Previously a
// synthetic icosahedral triangle was used here, which only worked while the
// projection computed its constants from the per-call triangle.
const TEST_SPHERICAL_TRIANGLE = new CRS().getCanonicalTriangle().map(v => [v[0], v[1], v[2]]);

// Different to shape used in app, but should not matter as barycentric coordinates are used
const TEST_FACE_TRIANGLE = [
  [0, 0],
  [0, 1],
  [1, 0]
];

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
  ...range.map(n => [1 - n, n]),

  // Points hugging arc BC (the hypotenuse x + y = 1, i.e. rho = 1 - b0 -> 1).
  // This is the only region where D-normalization in the inverse matters: the
  // result P approaches D on arc BC, so it inherits D's unit-length error. These
  // exercise the round-trip there at decreasing distance from the arc and across
  // its span (midpoint and either side).
  [0.4995, 0.4995], // rho = 0.999, arc midpoint
  [0.49995, 0.49995], // rho = 0.9999
  [0.499995, 0.499995], // rho = 0.99999
  [0.4999995, 0.4999995], // rho = 0.999999
  [0.49999995, 0.49999995], // rho = 0.9999999
  [0.6, 0.3995], // rho = 0.9995, toward C
  [0.3995, 0.6], // rho = 0.9995, toward B
  [0.75, 0.2497], // rho = 0.9997, nearer C
  [0.2497, 0.75], // rho = 0.9997, nearer B
  [0.85, 0.1499] // rho = 0.9999, near C
];

function generateRandomFacePoint() {
  const x = Math.random();
  const y = (1 - x) * Math.random();
  return [x, y];
}

const equalArea = new EqualAreaProjection(TEST_SPHERICAL_TRIANGLE);
function generateRandomSphericalPoint() {
  return equalArea.inverse(generateRandomFacePoint(), TEST_FACE_TRIANGLE, TEST_SPHERICAL_TRIANGLE);
}

// Custom configuration for equal-area projection
const config = {
  projectionName: 'equal-area',
  ProjectionClass: EqualAreaProjection,
  generateRandomForwardInput: generateRandomSphericalPoint,
  generateRandomInverseInput: generateRandomFacePoint,
  specificInverseInputs: SPECIFIC_FACE_POINTS,
  forwardTestCount: 200,
  inverseTestCount: 200,
  constructorParams: [TEST_SPHERICAL_TRIANGLE],
  forwardParams: [TEST_SPHERICAL_TRIANGLE, TEST_FACE_TRIANGLE],
  inverseParams: [TEST_FACE_TRIANGLE, TEST_SPHERICAL_TRIANGLE],
  postGenerate: testData => {
    testData.static = {
      TEST_SPHERICAL_TRIANGLE,
      TEST_FACE_TRIANGLE
    };
    return testData;
  }
};

generateProjectionTests(config);

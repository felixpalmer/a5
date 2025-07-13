const { PolyhedralProjection } = require("../../a5-test.cjs");
const { generateProjectionTests } = require("../projection-generator.cjs");
const { vec3 } = require("gl-matrix");

// Static test data that must be included
const φ = (1 + Math.sqrt(5)) / 2;

// Create spherical triangle from scratch from dodecahedron definition
const DODEC_FACE = [
  vec3.fromValues(1 / φ, 0, φ),
  vec3.fromValues(-1 / φ, 0, φ),
  vec3.fromValues(1, 1, 1),
  vec3.fromValues(-1, 1, 1),
  vec3.fromValues(0, φ, 1 / φ)
];

// Convert to unit dodecahedron
for (const vertex of DODEC_FACE) {
  vec3.normalize(vertex, vertex);
}

// Obtain center of face
const DODEC_FACE_CENTER = vec3.create();
for (const vertex of DODEC_FACE) {
  vec3.add(DODEC_FACE_CENTER, DODEC_FACE_CENTER, vertex);
}
vec3.scale(DODEC_FACE_CENTER, DODEC_FACE_CENTER, 1 / DODEC_FACE.length);

// Obtain midpoint of edge
const DODEC_EDGE_MIDPOINT = vec3.create();
vec3.lerp(DODEC_EDGE_MIDPOINT, DODEC_FACE[0], DODEC_FACE[1], 0.5);

// Finally use one dodecahedron vertex for the final triangle vertex
const DODEC_VERTEX = DODEC_FACE[1];

// Alternative spherical triangle for testing
const ZEROED_CENTER = [0, 0, 1];
const ZEROED_VERTEX = [(φ - 1) / Math.cos(Math.PI / 5), φ - 1, 1];
const ZEROED_EDGE_MIDPOINT = [0, φ - 1, 1];

const TEST_SPHERICAL_TRIANGLE = [ZEROED_CENTER, ZEROED_VERTEX, ZEROED_EDGE_MIDPOINT];
// Project to sphere
TEST_SPHERICAL_TRIANGLE.forEach(p => vec3.normalize(p, p));

const TEST_FACE_TRIANGLE = [[0, 0], [0, 1], [1, 0]];

// Specific test points from the original test data
const SPECIFIC_FACE_POINTS = [
  [0, 0],  // vertex A
  [1, 0],  // vertex B
  [0, 1],  // vertex C
  [0, 0],
  [0, 0.001],
  [0, 0.0001],
  [0, 0.9],
  [0, 0.99],
  [0, 0.999],
  [0, 0.9991],
  [0, 0.9999],
  [0, 0.99999],
  [0, 0.999999],
  [0, 0.9999999],
  [0, 0.99999999],
  [0, 0.999999999],
  [0, 0.9999999999],
  [0, 0.99999999999],
  [0, 0.999999999999],
  [0, 0.9999999999999],
  [0.0, 0.4],
  [0.2, 0.4],
  [0.4, 0.4],
  [0.0, 0.5],
  [0.0, 0.6],
  [0.0, 0.9],
  // Difficult points (thrown up by random testing)
  [0.07014313993250365,0.9298568600674963],
  [0.9561208684797726,0.043821975867140296],
  [0.9801671359068279,0.011065580403455679],
  [0.8565287887089067,0.14204220534719342],
  [0.9960934042866861,0.002268926948860536]
];

// These points break when safeAcos is not used
const TEST_POINTS_DIFFICULT = [
  [0, 0.1],
  [0, 0.01],
  [0, 0.001],
  [0, 0.0001],
  [0, 0.00001],
  [0, 0.000001],
  [0, 0.0000001],
  [0, 0.00000001],
];

const REVERSED_TEST_POINTS = SPECIFIC_FACE_POINTS.map(point => [point[1], point[0]]);

// Combine all specific points
const ALL_SPECIFIC_POINTS = [
  ...SPECIFIC_FACE_POINTS,
  ...TEST_POINTS_DIFFICULT,
  ...REVERSED_TEST_POINTS
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
  specificInverseInputs: ALL_SPECIFIC_POINTS,
  forwardTestCount: 50,
  inverseTestCount: 50,
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
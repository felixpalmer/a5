import type { Cartesian, Face, FaceTriangle, SphericalTriangle } from 'a5/core/coordinate-systems';
import * as vec3 from '../../../modules/math/vec3';
const TEST_POINTS: Face[] = [
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
] as Face[];

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
] as Face[];
TEST_POINTS.push(...TEST_POINTS_DIFFICULT);

const REVERSED_TEST_POINTS: Face[] = TEST_POINTS.map(point => [point[1],  point[0]] as Face);
TEST_POINTS.push(...REVERSED_TEST_POINTS);

for (let i = 0; i < 100; i++) {
  const x = Math.random();
  const y = (1 - x) * Math.random();
  TEST_POINTS.push([x, y] as Face);
}

// Create spherical triangle from scratch from dodecahedron definition
const φ = (1 + Math.sqrt(5)) / 2;
const DODEC_FACE = [
  vec3.fromValues(1 / φ, 0, φ),
  vec3.fromValues(-1 / φ, 0, φ),
  vec3.fromValues(1, 1, 1),
  vec3.fromValues(-1, 1, 1),
  vec3.fromValues(0, φ, 1 / φ)
];

// Convert to unit dodecahedron (likely unnecessary)
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
const ZEROED_CENTER = [0, 0, 1] as Cartesian;
const ZEROED_VERTEX = [(φ - 1) / Math.cos(Math.PI / 5), φ - 1, 1] as Cartesian;
const ZEROED_EDGE_MIDPOINT = [0, φ - 1, 1] as Cartesian;

const TEST_SPHERICAL_TRIANGLE = [ZEROED_CENTER, ZEROED_VERTEX, ZEROED_EDGE_MIDPOINT] as SphericalTriangle;
// const TEST_SPHERICAL_TRIANGLE = [DODEC_FACE_CENTER, DODEC_VERTEX, DODEC_EDGE_MIDPOINT] as SphericalTriangle;

// Project to sphere
TEST_SPHERICAL_TRIANGLE.forEach(p => vec3.normalize(p, p));
const TEST_FACE_TRIANGLE = [[0, 0], [0, 1], [1, 0]] as FaceTriangle;

export { TEST_POINTS, TEST_LINE_POINTS, TEST_LINE_SPHERICAL, TEST_SPHERICAL_TRIANGLE, TEST_FACE_TRIANGLE };

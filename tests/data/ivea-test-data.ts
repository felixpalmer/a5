import type { Cartesian, Face, FaceTriangle, SphericalTriangle } from 'a5/core/coordinate-systems';
import { vec3 } from 'gl-matrix';
const TEST_POINTS: Face[] = [
  [0, 0],  // vertex A
  [1, 0],  // vertex B
  [0, 1],  // vertex C
  [0, 0],
  [0, 0.001],
  [0, 0.0001],
  [0, 0.00001],
  [0, 0.000001],
  [0, 0.0000001],
  [0, 0.00000001],
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

// Project to sphere
vec3.normalize(DODEC_VERTEX, DODEC_VERTEX);
vec3.normalize(DODEC_EDGE_MIDPOINT, DODEC_EDGE_MIDPOINT);
vec3.normalize(DODEC_FACE_CENTER, DODEC_FACE_CENTER);

const TEST_SPHERICAL_TRIANGLE = [DODEC_FACE_CENTER, DODEC_VERTEX, DODEC_EDGE_MIDPOINT] as SphericalTriangle;
const TEST_FACE_TRIANGLE = [[0, 0], [0, 1], [1, 0]] as FaceTriangle;

// Test between two know points where accuracy is low
const TEST_LINE_POINTS: [number, number][] = [ [0, 0], [0, 0.001] ];
const TEST_LINE_SPHERICAL: Cartesian[] = [
  DODEC_FACE_CENTER, // from inverse projection of [0, 0]
  [ -0.00037668322944968635, 0.525289975755766, 0.850923204220129 ] // from inverse projection of [0, 0.001]
] as Cartesian[];

export { TEST_POINTS, TEST_LINE_POINTS, TEST_LINE_SPHERICAL, TEST_SPHERICAL_TRIANGLE, TEST_FACE_TRIANGLE };
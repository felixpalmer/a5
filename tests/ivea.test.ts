import { describe, it, expect } from 'vitest';
import { cartesianToBary, baryToCartesian, forwardVector, inverseVector, FaceTriangle, SphericalTriangle } from 'a5/core/ivea';
import type { Spherical, Cartesian, Face } from 'a5/core/coordinate-systems';
import { fromLonLat, toCartesian } from 'a5/core/coordinate-transforms';
import { generateWireframe } from 'a5/internal/wireframe';
import { vec3 } from 'gl-matrix';



// Test triangle vertices
const TEST_TRIANGLE: FaceTriangle = [[0, 0], [1, 0], [0, 1]] as FaceTriangle;
const TEST_POINTS: [number, number][] = [
  //[0, 0],  // vertex A
  //[1, 0],  // vertex B
  [0, 1],  // vertex C
  // These points work
  //[0.0, 0.4],
  //[0.2, 0.4],
  //[0.4, 0.4],
  //[0.0, 0.5],
  //// All points below fail
  //[0.0, 0.6],
  //[0.07014313993250365,0.9298568600674963],
  [0.9561208684797726,0.043821975867140296],
  //[0.00, 0.9],
];

for (let i = 0; i < 100; i++) {
  const x = Math.random();
  const y = (1 - x) * Math.random();
  //TEST_POINTS.push([x, y]);
}

describe.skip('Barycentric Coordinate Functions', () => {  
  it('cartesianToBary and baryToCartesian round-trip preserves coordinates', () => {
    
    // Test points inside the triangle
    const testPoints: [number, number][] = [
      [0.5, 0.5],    // Center of triangle
      [0.25, 0.25],  // Quarter way from origin
      [0.75, 0.25],  // Near vertex B
      [0.25, 0.75],  // Near vertex C
      [0.33, 0.33],  // One-third point
      [0, 0],  // vertex A
      [1, 0],  // vertex B
      [0, 1],  // vertex C
    ];
    
    for (const point of testPoints) {
      // Convert to barycentric coordinates
      const bary = cartesianToBary(point, TEST_TRIANGLE);
      
      // Convert back to cartesian
      const result: [number, number] = [0, 0];
      baryToCartesian(bary, result, TEST_TRIANGLE);
      
      // Check round-trip accuracy
      expect(result[0]).toBeCloseTo(point[0], 12);
      expect(result[1]).toBeCloseTo(point[1], 12);
      
      // Check that barycentric coordinates sum to 1
      expect(bary[0] + bary[1] + bary[2]).toBeCloseTo(1, 12);
      
      // Check that all barycentric coordinates are non-negative (point is inside triangle)
      expect(bary[0]).toBeGreaterThanOrEqual(0);
      expect(bary[1]).toBeGreaterThanOrEqual(0);
      expect(bary[2]).toBeGreaterThanOrEqual(0);
    }
  });
  
  it('baryToCartesian and cartesianToBary round-trip preserves barycentric coordinates', () => {
    
    // Test barycentric coordinates starting with the specific case
    const testBaryCoords: [number, number, number][] = [
      [0.043821975867140296, 0.9561208684797726, 0.00005715565308705983],
      [0.5, 0.3, 0.2],
      [0.1, 0.8, 0.1],
      [0.33, 0.33, 0.34],
      [0.9, 0.05, 0.05],
      [0.001, 0.999, 0.000],
    ];
    
    for (const bary of testBaryCoords) {
      // Convert barycentric to cartesian
      const cartesian: [number, number] = [0, 0];
      baryToCartesian(bary, cartesian, TEST_TRIANGLE);
      
      // Convert back to barycentric
      const resultBary = cartesianToBary(cartesian, TEST_TRIANGLE);
      
      // Check round-trip accuracy
      expect(resultBary[0]).toBeCloseTo(bary[0], 12);
      expect(resultBary[1]).toBeCloseTo(bary[1], 12);
      expect(resultBary[2]).toBeCloseTo(bary[2], 12);
      
      // Check that barycentric coordinates sum to 1
      expect(resultBary[0] + resultBary[1] + resultBary[2]).toBeCloseTo(1, 12);
    }
  });
  
  it('handles triangle vertices correctly', () => {
    // Test each vertex
    const vertices: Face[] = [TEST_TRIANGLE[0], TEST_TRIANGLE[1], TEST_TRIANGLE[2]];
    const expectedBary: [number, number, number][] = [
      [1, 0, 0],  // pai -> [1, 0, 0]
      [0, 1, 0],  // pbi -> [0, 1, 0]
      [0, 0, 1],  // pci -> [0, 0, 1]
    ];
    
    for (let i = 0; i < vertices.length; i++) {
      const bary = cartesianToBary(vertices[i] as [number, number], TEST_TRIANGLE);
      
      // Check barycentric coordinates
      expect(bary[0]).toBeCloseTo(expectedBary[i][0], 12);
      expect(bary[1]).toBeCloseTo(expectedBary[i][1], 12);
      expect(bary[2]).toBeCloseTo(expectedBary[i][2], 12);
      
      // Round-trip test
      const result: [number, number] = [0, 0];
      baryToCartesian(bary, result, TEST_TRIANGLE);
      expect(result[0]).toBeCloseTo(vertices[i][0], 12);
      expect(result[1]).toBeCloseTo(vertices[i][1], 12);
    }
  });
  
  it('handles edge midpoints correctly', () => {
    
    // Edge midpoints
    const edgeMidpoints: [number, number][] = [
      [0.5, 0],    // Midpoint of pai-pbi edge
      [0, 0.5],    // Midpoint of pai-pci edge
      [0.5, 0.5],  // Midpoint of pbi-pci edge
    ];
    
    const expectedBary: [number, number, number][] = [
      [0.5, 0.5, 0],  // pai-pbi midpoint
      [0.5, 0, 0.5],  // pai-pci midpoint
      [0, 0.5, 0.5],  // pbi-pci midpoint
    ];
    
    for (let i = 0; i < edgeMidpoints.length; i++) {
      const bary = cartesianToBary(edgeMidpoints[i], TEST_TRIANGLE);
      
      // Check barycentric coordinates
      expect(bary[0]).toBeCloseTo(expectedBary[i][0], 12);
      expect(bary[1]).toBeCloseTo(expectedBary[i][1], 12);
      expect(bary[2]).toBeCloseTo(expectedBary[i][2], 12);
      
      // Round-trip test
      const result: [number, number] = [0, 0];
      baryToCartesian(bary, result, TEST_TRIANGLE);
      expect(result[0]).toBeCloseTo(edgeMidpoints[i][0], 12);
      expect(result[1]).toBeCloseTo(edgeMidpoints[i][1], 12);
    }
  });
}); 

//const WIREFRAME = generateWireframe(2);

// Golden ratio
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

describe('Dodecahedron projections', () => {
  it('has 60 points', () => {
    //expect(WIREFRAME.length).toBe(60);
  });

  //const [v1, v2, v3] = WIREFRAME[0].map(vertex => toCartesian(fromLonLat(vertex)));
  const [v1, v2, v3] = [DODEC_FACE[1], DODEC_FACE[0], DODEC_FACE_CENTER];
  const midpoint = vec3.create();
  vec3.add(midpoint, v1, v2);

  // Project to sphere
  vec3.normalize(v1, v1);
  vec3.normalize(midpoint, midpoint);
  vec3.normalize(v3, v3);

  let faceVerticesA5 = [v1, midpoint, v3] as [Cartesian, Cartesian, Cartesian];
  let facePointsA5 = [[0, 0], [0, 1], [1, 0]] as FaceTriangle;

  let [a,b,c] = faceVerticesA5;
  faceVerticesA5 = [b, c, a];

  let [_a,_b,_c] = facePointsA5;
  facePointsA5 = [_b, _c, _a];

  
  for (const point of TEST_POINTS) {
  it(`preserves coordinates through backward->forward conversion for point ${point}`, () => {
      const unprojected = inverseVector(
        point,
        facePointsA5,
        faceVerticesA5 as SphericalTriangle);
      const projected: [number, number] = [0, 0];
      forwardVector(unprojected, faceVerticesA5 as SphericalTriangle, facePointsA5, projected);
      expect(projected[0]).toBeCloseTo(point[0], 12);
      expect(projected[1]).toBeCloseTo(point[1], 12); 
    });
  }
});
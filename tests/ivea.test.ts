import { describe, it, expect } from 'vitest';
import { forwardVector, inverseVector } from 'a5/core/ivea';
import type { Cartesian, Face, FaceTriangle, SphericalTriangle } from 'a5/core/coordinate-systems';
import { vec2, vec3 } from 'gl-matrix';
import { TEST_POINTS, TEST_LINE_POINTS, TEST_LINE_SPHERICAL, TEST_SPHERICAL_TRIANGLE, TEST_FACE_TRIANGLE } from './data/ivea-test-data';

describe('Tolerance', () => {
  const TOLERANCE = 11; // Set to 10 to fail
  const angle = vec3.angle(TEST_SPHERICAL_TRIANGLE[0], TEST_SPHERICAL_TRIANGLE[1]);
  const AUTHALIC_RADIUS = 6371.0072; // km
  const arcLength = AUTHALIC_RADIUS * angle;
  const MM_TO_KM = 9;
  const DESIRED_MM_PRECISION = 50;
  // const DESIRED_MM_PRECISION = 1; // Ideal, but not there yet for all points

  it(`is accurate to ${DESIRED_MM_PRECISION} mm`, () => {
    expect(arcLength * Math.pow(10, MM_TO_KM - TOLERANCE)).toBeLessThan(DESIRED_MM_PRECISION);
  });
});

describe('Dodecahedron projections', () => {
  // General case OK for TOLERANCE = 14, but some points are not OK for TOLERANCE = 12+
  const TOLERANCE = 11; // Set to 12 to see failure
  for (const point of TEST_POINTS) {
    it(`preserves coordinates through backward->forward conversion for point ${point}`, () => {
      const unprojected = inverseVector(
        point,
        TEST_FACE_TRIANGLE,
        TEST_SPHERICAL_TRIANGLE);
      
      const projected = forwardVector(unprojected, TEST_SPHERICAL_TRIANGLE, TEST_FACE_TRIANGLE);
      expect(projected[0]).toBeCloseTo(point[0], TOLERANCE);
      expect(projected[1]).toBeCloseTo(point[1], TOLERANCE); 
    });
  }
});

// forward projection is less accurate (TOLERANCE = 10), than inverse projection (TOLERANCE = 15)
describe('Dodecahedron projections (line)', () => {
  const N = 10;

  for (let i = 0; i <= N; i++) {
    it(`projects TEST_LINE_SPHERICAL to TEST_LINE_POINTS correctly ${i}/${N}`, () => {
      const TOLERANCE = 10; // Set to 11 to see failure
      const sphericalPoint = vec3.lerp(vec3.create(), TEST_LINE_SPHERICAL[0], TEST_LINE_SPHERICAL[1], i / N) as Cartesian;
      vec3.normalize(sphericalPoint, sphericalPoint);
      const expectedFacePoint = vec2.lerp(vec2.create(), TEST_LINE_POINTS[0], TEST_LINE_POINTS[1], i / N);

      const projected = forwardVector(sphericalPoint, TEST_SPHERICAL_TRIANGLE, TEST_FACE_TRIANGLE);
      expect(projected[0]).toBeCloseTo(expectedFacePoint[0], TOLERANCE);
      expect(projected[1]).toBeCloseTo(expectedFacePoint[1], TOLERANCE);
    });
  }

  for (let i = 0; i <= N; i++) {
    it(`projects TEST_LINE_POINTS to TEST_LINE_SPHERICAL correctly ${i}/${N}`, () => {
      const TOLERANCE = 15; // Set to 16 to see failure
      const facePoint = vec2.lerp(vec2.create(), TEST_LINE_POINTS[0], TEST_LINE_POINTS[1], i / N) as Face;
      const expectedSphericalPoint = vec3.lerp(vec3.create(), TEST_LINE_SPHERICAL[0], TEST_LINE_SPHERICAL[1], i / N) as Cartesian;
      vec3.normalize(expectedSphericalPoint, expectedSphericalPoint);

      const unprojected = inverseVector(facePoint, TEST_FACE_TRIANGLE, TEST_SPHERICAL_TRIANGLE);
      expect(unprojected[0]).toBeCloseTo(expectedSphericalPoint[0], TOLERANCE);
      expect(unprojected[1]).toBeCloseTo(expectedSphericalPoint[1], TOLERANCE);
      expect(unprojected[2]).toBeCloseTo(expectedSphericalPoint[2], TOLERANCE);
    });
  }
});
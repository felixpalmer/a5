import { describe, it, expect } from 'vitest';
import { PolyhedralProjection } from '../../modules/projections/polyhedral';
import { vec3 } from 'gl-matrix';
import { TEST_POINTS, TEST_SPHERICAL_TRIANGLE, TEST_FACE_TRIANGLE } from './data/polyhedral-test-data';

const AUTHALIC_RADIUS = 6371.0072; // km
const MAX_ANGLE = Math.max(
  vec3.angle(TEST_SPHERICAL_TRIANGLE[0], TEST_SPHERICAL_TRIANGLE[1]),
  vec3.angle(TEST_SPHERICAL_TRIANGLE[1], TEST_SPHERICAL_TRIANGLE[2]),
  vec3.angle(TEST_SPHERICAL_TRIANGLE[2], TEST_SPHERICAL_TRIANGLE[0])
);
const MAX_ARC_LENGTH_MM = AUTHALIC_RADIUS * MAX_ANGLE * 1e9;
const DESIRED_MM_PRECISION = 0.05;

describe('Dodecahedron projections', () => {
  const polyhedral = new PolyhedralProjection();
  const TOLERANCE = 13; // Set to 14 to see failure
  let largestError = 0;
  for (const point of TEST_POINTS) {
    it(`preserves coordinates through backward->forward conversion for point ${point}`, () => {
      const unprojected = polyhedral.inverse(
        point,
        TEST_FACE_TRIANGLE,
        TEST_SPHERICAL_TRIANGLE);
      const projected = polyhedral.forward(unprojected, TEST_SPHERICAL_TRIANGLE, TEST_FACE_TRIANGLE);
      largestError = Math.max(largestError, projected[0] - point[0], projected[1] - point[1]);
      expect([...projected]).toBeCloseToArray([...point], TOLERANCE);
    });
  }

  it(`is accurate to ${DESIRED_MM_PRECISION}mm`, () => {
    expect(largestError * MAX_ARC_LENGTH_MM).toBeLessThan(DESIRED_MM_PRECISION);
  });
});
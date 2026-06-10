import {glMatrix, vec3} from 'gl-matrix';
glMatrix.setMatrixArrayType(Float64Array as any);
import {describe, it, expect} from 'vitest';
import {EqualAreaProjection} from '../../modules/projections/equal-area';
import TEST_DATA from './fixtures/equal-area.json';
import {Cartesian} from '../../modules/core/coordinate-systems';

// Extract static data from test data
const {TEST_SPHERICAL_TRIANGLE, TEST_FACE_TRIANGLE} = TEST_DATA.static;

const AUTHALIC_RADIUS = 6371.0072; // km
const MAX_ANGLE = Math.max(
  vec3.angle(TEST_SPHERICAL_TRIANGLE[0] as Cartesian, TEST_SPHERICAL_TRIANGLE[1] as Cartesian),
  vec3.angle(TEST_SPHERICAL_TRIANGLE[1] as Cartesian, TEST_SPHERICAL_TRIANGLE[2] as Cartesian),
  vec3.angle(TEST_SPHERICAL_TRIANGLE[2] as Cartesian, TEST_SPHERICAL_TRIANGLE[0] as Cartesian)
);
const MAX_ARC_LENGTH_MM = AUTHALIC_RADIUS * MAX_ANGLE * 1e9;
const DESIRED_MM_PRECISION = 0.01;

describe('EqualAreaProjection forward', () => {
  const equalArea = new EqualAreaProjection();
  let largestError = 0;

  it('forward projections', () => {
    TEST_DATA.forward.forEach((testCase, index) => {
      const result = equalArea.forward(
        testCase.input as any,
        TEST_SPHERICAL_TRIANGLE as any,
        TEST_FACE_TRIANGLE as any
      );
      expect(result).toBeCloseToArray(testCase.expected as number[]);
    });
  });

  it('round trip forward projections', () => {
    TEST_DATA.forward.forEach((testCase, index) => {
      const spherical = testCase.input as any;
      const polar = equalArea.forward(spherical, TEST_SPHERICAL_TRIANGLE as any, TEST_FACE_TRIANGLE as any);
      const result = equalArea.inverse(polar, TEST_FACE_TRIANGLE as any, TEST_SPHERICAL_TRIANGLE as any);
      largestError = Math.max(largestError, vec3.distance(result, spherical));
      expect(result).toBeCloseToArray(spherical);
    });
  });

  it(`is accurate to ${DESIRED_MM_PRECISION}mm`, () => {
    expect(largestError * MAX_ARC_LENGTH_MM).toBeLessThan(DESIRED_MM_PRECISION);
  });
});

describe('EqualAreaProjection inverse', () => {
  const equalArea = new EqualAreaProjection();

  it('inverse projections', () => {
    TEST_DATA.inverse.forEach((testCase, index) => {
      const result = equalArea.inverse(
        testCase.input as any,
        TEST_FACE_TRIANGLE as any,
        TEST_SPHERICAL_TRIANGLE as any
      );
      expect(result).toBeCloseToArray(testCase.expected as number[]);
    });
  });

  it('round trip inverse projections', () => {
    TEST_DATA.inverse.forEach((testCase, index) => {
      const facePoint = testCase.input as any;
      const spherical = equalArea.inverse(facePoint, TEST_FACE_TRIANGLE as any, TEST_SPHERICAL_TRIANGLE as any);
      const result = equalArea.forward(spherical, TEST_SPHERICAL_TRIANGLE as any, TEST_FACE_TRIANGLE as any);
      expect(result).toBeCloseToArray(facePoint);
    });
  });
});

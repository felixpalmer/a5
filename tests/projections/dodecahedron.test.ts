import { describe, it, expect } from 'vitest';
import { DodecahedronProjection } from '../../modules/projections/dodecahedron';
import TEST_DATA from './fixtures/dodecahedron.json';
import type { OriginId } from '../../modules/core/utils';

// Extract static data from test data
const { ORIGIN_ID } = TEST_DATA.static;
const originId = ORIGIN_ID as OriginId;

describe('DodecahedronProjection forward', () => {
  const dodecahedron = new DodecahedronProjection();
  
  it('forward projections', () => {
    TEST_DATA.forward.forEach((testCase) => {
      const result = dodecahedron.forward(testCase.input as any, originId);
      expect(result).toBeCloseToArray(testCase.expected as number[]);
    });
  });

  it('round trip forward projections', () => {
    TEST_DATA.forward.forEach((testCase) => {
      const spherical = testCase.input as any;
      const face = dodecahedron.forward(spherical, originId);
      const result = dodecahedron.inverse(face, originId);
      expect(result).toBeCloseToArray(spherical);
    });
  });
});

describe('DodecahedronProjection inverse', () => {
  const dodecahedron = new DodecahedronProjection();
  
  it('inverse projections', () => {
    TEST_DATA.inverse.forEach((testCase) => {
      const result = dodecahedron.inverse(testCase.input as any, originId);
      expect(result).toBeCloseToArray(testCase.expected as number[]);
    });
  });

  it('round trip inverse projections', () => {
    TEST_DATA.inverse.forEach((testCase) => {
      const facePoint = testCase.input as any;
      const spherical = dodecahedron.inverse(facePoint, originId);
      const result = dodecahedron.forward(spherical, originId);
      expect(result).toBeCloseToArray(facePoint);
    });
  });
});
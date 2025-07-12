import { describe, it, expect } from 'vitest'
import { GnomonicProjection } from '../../modules/projections/gnomonic'
import type { Polar, Spherical } from 'a5/core/coordinate-systems'
import TEST_DATA from './data/gnomonic-test-data.json';

const TOLERANCE = 12;
const gnomonic = new GnomonicProjection();

describe('GnomonicProjection forward', () => {
  TEST_DATA.forward.forEach((testCase, index) => {
    it(`forward test case ${index + 1}`, () => {
      const result = gnomonic.forward(testCase.input as Spherical);
      expect(result[0]).toBeCloseTo(testCase.expected[0], TOLERANCE);
      expect(result[1]).toBeCloseTo(testCase.expected[1], TOLERANCE);
    });

    it(`round trip forward test case ${index + 1}`, () => {
      const spherical = testCase.input as Spherical;
      const polar = gnomonic.forward(spherical);
      const result = gnomonic.inverse(polar);
      
      expect(result[0]).toBeCloseTo(spherical[0], TOLERANCE);
      expect(result[1]).toBeCloseTo(spherical[1], TOLERANCE);
    });
  });
});

describe('GnomonicProjection inverse', () => {
  TEST_DATA.inverse.forEach((testCase, index) => {
    it(`inverse test case ${index + 1}`, () => {
      const result = gnomonic.inverse(testCase.input as Polar);
      expect(result[0]).toBeCloseTo(testCase.expected[0], TOLERANCE);
      expect(result[1]).toBeCloseTo(testCase.expected[1], TOLERANCE);
    });

    it(`round trip inverse test case ${index + 1}`, () => {
      const polar = testCase.input as Polar;
      const spherical = gnomonic.inverse(polar);
      const result = gnomonic.forward(spherical);
      
      expect(result[0]).toBeCloseTo(polar[0], TOLERANCE);
      expect(result[1]).toBeCloseTo(polar[1], TOLERANCE);
    });
  });
}); 
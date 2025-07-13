import { describe, it, expect } from 'vitest'
import { GnomonicProjection } from '../../modules/projections/gnomonic'
import type { Polar, Spherical } from 'a5/core/coordinate-systems'
import TEST_DATA from './fixtures/gnomonic.json';

const gnomonic = new GnomonicProjection();

describe('GnomonicProjection forward', () => {
  it('forward projections', () => {
    TEST_DATA.forward.forEach((testCase, index) => {
      const result = gnomonic.forward(testCase.input as Spherical);
      expect(result).toBeCloseToArray(testCase.expected);
    });
  });

  it('round trip forward projections', () => {
    TEST_DATA.forward.forEach((testCase, index) => {
      const spherical = testCase.input as Spherical;
      const polar = gnomonic.forward(spherical);
      const result = gnomonic.inverse(polar);
      expect(result).toBeCloseToArray(spherical);
    });
  });
});

describe('GnomonicProjection inverse', () => {
  it('inverse projections', () => {
    TEST_DATA.inverse.forEach((testCase, index) => {
      const result = gnomonic.inverse(testCase.input as Polar);
      expect(result).toBeCloseToArray(testCase.expected);
    });
  });

  it('round trip inverse projections', () => {
    TEST_DATA.inverse.forEach((testCase, index) => {
      const polar = testCase.input as Polar;
      const spherical = gnomonic.inverse(polar);
      const result = gnomonic.forward(spherical);
      expect(result).toBeCloseToArray(polar);
    });
  });
}); 
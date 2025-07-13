import { describe, it, expect } from 'vitest'
import { AuthalicProjection } from '../../modules/projections/authalic'
import type { Radians } from 'a5/core/coordinate-systems'
import TEST_DATA from './fixtures/authalic.json'

const authalic = new AuthalicProjection();

describe('AuthalicProjection forward', () => {
  it('forward projections', () => {
    TEST_DATA.forward.forEach((testCase, index) => {
      const result = authalic.forward(testCase.input as Radians);
      expect(result).toBeCloseTo(testCase.expected, 10);
    });
  });

  it('round trip forward projections', () => {
    TEST_DATA.forward.forEach((testCase, index) => {
      const input = testCase.input as Radians;
      const polar = authalic.forward(input);
      const result = authalic.inverse(polar);
      expect(result).toBeCloseTo(input, 15);
    });
  });
});

describe('AuthalicProjection inverse', () => {
  it('inverse projections', () => {
    TEST_DATA.inverse.forEach((testCase, index) => {
      const result = authalic.inverse(testCase.input as Radians);
      expect(result).toBeCloseTo(testCase.expected, 10);
    });
  });

  it('round trip inverse projections', () => {
    TEST_DATA.inverse.forEach((testCase, index) => {
      const input = testCase.input as Radians;
      const spherical = authalic.inverse(input);
      const result = authalic.forward(spherical);
      expect(result).toBeCloseTo(input, 15);
    });
  });
}); 
import { describe, it, expect } from 'vitest'
import { AuthalicProjection } from '../../modules/projections/authalic'
import type { Radians } from 'a5/core/coordinate-systems'
import TEST_DATA from './data/authalic-test-data.json'

const authalic = new AuthalicProjection();

describe('AuthalicProjection forward', () => {
  it('forward projections', () => {
    TEST_DATA.forward.forEach((testCase, index) => {
      const result = authalic.forward(testCase.input as Radians);
      expect(result).toBeCloseTo(testCase.expected, 10);
    });
  });

  it('round trip forward projections', () => {
    TEST_DATA.roundTrip.forEach((testCase, index) => {
      const input = testCase.input as Radians;
      const forwardResult = authalic.forward(input);
      const result = authalic.inverse(forwardResult);
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
    TEST_DATA.roundTrip.forEach((testCase, index) => {
      const input = testCase.input as Radians;
      const forwardResult = authalic.forward(input);
      const result = authalic.inverse(forwardResult);
      expect(result).toBeCloseTo(input, 15);
    });
  });
});

describe('AuthalicProjection specific values', () => {
  it('matches reference conversion values', () => {
    TEST_DATA.specificValues.forEach((testCase, index) => {
      const result = authalic.forward(testCase.geodeticRadians as Radians);
      expect(result).toBeCloseTo(testCase.authalicRadians, 5);
    });
  });
}); 
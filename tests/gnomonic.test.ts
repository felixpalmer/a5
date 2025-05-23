import { describe, it, expect } from 'vitest'
import { projectGnomonic, unprojectGnomonic } from 'a5/core/gnomonic'
import type { Polar, Spherical } from 'a5/core/coordinate-systems'
import TEST_COORDS from './test-polar-coordinates.json';

describe('projectGnomonic', () => {
  const TEST_VALUES = [
    {input: [0.001, 0] as Polar, expected: [0, 0.001] as Spherical},
    {input: [0.001, 0.321] as Polar, expected: [0.321, 0.001] as Spherical},
    {input: [1, Math.PI] as Polar, expected: [Math.PI, Math.PI / 4] as Spherical},
    {input: [0.5, 0.777] as Polar, expected: [0.777, Math.atan(0.5)] as Spherical},
  ];

  for (const {input, expected} of TEST_VALUES) {
    it(`projectGnomonic([${input[0]}, ${input[1]}]) returns expected values`, () => {
      const result = projectGnomonic(input);
      expect(result[0]).toBeCloseTo(expected[0], 4);
      expect(result[1]).toBeCloseTo(expected[1], 4);
    });
  }

  for (const {input, expected} of TEST_VALUES) {
    it(`unprojectGnomonic([${expected[0]}, ${expected[1]}]) returns expected values`, () => {
      const result = unprojectGnomonic(expected);
      expect(result[0]).toBeCloseTo(input[0], 4);
      expect(result[1]).toBeCloseTo(input[1], 4);
    });
  }

  it('round trips with projectGnomonic', () => {
    const polar = [0.3, 0.4] as Polar;
    const spherical = projectGnomonic(polar);
    const result = unprojectGnomonic(spherical);
    expect(result[0]).toBeCloseTo(polar[0], 4);
    expect(result[1]).toBeCloseTo(polar[1], 4);
  });
});

describe('polar coordinates round trip', () => {
  it('tests all coordinates', () => {
    TEST_COORDS.forEach((coord, i) => {
      const polar = [coord.rho, coord.beta] as Polar;
      const spherical = projectGnomonic(polar);
      const result = unprojectGnomonic(spherical);
      
      // Check that result values are close to original
      expect(result[0]).toBeCloseTo(polar[0]);
      expect(result[1]).toBeCloseTo(polar[1]);
    });
  });
}); 
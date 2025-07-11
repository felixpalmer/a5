import { describe, it, expect } from 'vitest'
import { GnomonicProjection } from '../../modules/projections/gnomonic'
import type { Polar, Spherical } from 'a5/core/coordinate-systems'
import TEST_COORDS from '../test-polar-coordinates.json';

const gnomonic = new GnomonicProjection();

describe('projectGnomonic', () => {
  const TEST_VALUES = [
    {input: [0, 0.001] as Spherical, expected: [0.001, 0] as Polar},
    {input: [0.321, 0.001] as Spherical, expected: [0.001, 0.321] as Polar},
    {input: [Math.PI, Math.PI / 4] as Spherical, expected: [1, Math.PI] as Polar},
    {input: [0.777, Math.atan(0.5)] as Spherical, expected: [0.5, 0.777] as Polar},
  ];

  for (const {input, expected} of TEST_VALUES) {
    it(`projectGnomonic([${input[0]}, ${input[1]}]) returns expected values`, () => {
      const result = gnomonic.forward(input);
      expect(result[0]).toBeCloseTo(expected[0], 4);
      expect(result[1]).toBeCloseTo(expected[1], 4);
    });
  }

  for (const {input, expected} of TEST_VALUES) {
    it(`unprojectGnomonic([${expected[0]}, ${expected[1]}]) returns expected values`, () => {
      const result = gnomonic.inverse(expected);
      expect(result[0]).toBeCloseTo(input[0], 4);
      expect(result[1]).toBeCloseTo(input[1], 4);
    });
  }

  it('round trips with projectGnomonic', () => {
    const spherical = [0.3, 0.4] as Spherical;
    const polar = gnomonic.forward(spherical);
    const result = gnomonic.inverse(polar);
    expect(result[0]).toBeCloseTo(spherical[0], 4);
    expect(result[1]).toBeCloseTo(spherical[1], 4);
  });
});

describe('polar coordinates round trip', () => {
  it('tests all coordinates', () => {
    TEST_COORDS.forEach((coord, i) => {
      const spherical = [coord.beta, coord.rho] as Spherical;
      const polar = gnomonic.forward(spherical);
      const result = gnomonic.inverse(polar);
      
      // Check that result values are close to original
      expect(result[0]).toBeCloseTo(spherical[0]);
      expect(result[1]).toBeCloseTo(spherical[1]);
    });
  });
}); 
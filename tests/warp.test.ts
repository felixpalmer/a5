import { describe, it, expect } from 'vitest'
import { warpPoint, unwarpPoint } from 'a5/core/warp'
import { normalizeGamma, warpPolar, unwarpPolar, warpBeta, unwarpBeta } from 'a5/core/warp'
import { PI_OVER_5, PI_OVER_10, TWO_PI_OVER_5, distanceToEdge } from 'a5/core/constants'
import type { Radians, Polar } from 'a5/core/coordinate-systems'
import TEST_COORDS from './test-polar-coordinates.json';

describe('normalizeGamma', () => {
  const TEST_VALUES = [
    {gamma: 0.1, normalized: 0.1},
    {gamma: 0.2, normalized: 0.2},
    {gamma: -0.2, normalized: -0.2},
    {gamma: 1.2, normalized: 1.2 - TWO_PI_OVER_5},
  ] as {gamma: Radians, normalized: number}[];

  for (const {gamma, normalized} of TEST_VALUES) {
    it(`normalizeGamma(${gamma}) = ${normalized}`, () => {
      const normalized2 = normalizeGamma(gamma);
      expect(normalized2).toBeCloseTo(normalized);
    });
  }

  it('is periodic with period 2*PI_OVER_5', () => {
    const TEST_VALUES = [-0.977, -0.72, 0.3, 0, 0.01, 0.14, 0.333, 0.5, 0.6198123, 0.77, 0.9];
    for (const value of TEST_VALUES) {
      const gamma1 = (value * PI_OVER_5) as Radians;
      const gamma2 = (gamma1 + 2 * PI_OVER_5) as Radians;
      const normalized1 = normalizeGamma(gamma1);
      const normalized2 = normalizeGamma(gamma2);
      expect(normalized1).toBeCloseTo(normalized2);
    }
  });
});

describe('warpPolar', () => {
  const TEST_VALUES = [
    {input: [0, 0] as Polar, warped: [0, 0] as Polar},
    {input: [1, 0] as Polar, warped: [1.2988, 0] as Polar},
    {input: [1, PI_OVER_5] as Polar, warped: [1.1723, PI_OVER_5] as Polar},
    {input: [1, -PI_OVER_5] as Polar, warped: [1.1723, -PI_OVER_5] as Polar},
    {input: [0.2, 0.0321] as Polar, warped: [0.1787, 0.03097] as Polar},
    {input: [0.789, -0.555] as Polar, warped: [0.8128, -0.55057] as Polar},
  ];

  for (const {input, warped} of TEST_VALUES) {
    it(`warpPolar([${input[0]}, ${input[1]}]) returns expected values`, () => {
      const result = warpPolar(input);
      expect(result[0]).toBeCloseTo(warped[0]);
      expect(result[1]).toBeCloseTo(warped[1]);
    });
  }

  it('preserves distance to edge', () => {
    const result = warpPolar([distanceToEdge, 0] as Polar);
    expect(result[0]).toBeCloseTo(distanceToEdge);
  });

  for (const {input, warped} of TEST_VALUES) {
    it(`unwarpPolar([${input[0]}, ${input[1]}]) returns expected values`, () => {
      const result = unwarpPolar(warped);
      expect(result[0]).toBeCloseTo(input[0]);
      expect(result[1]).toBeCloseTo(input[1]);
    });
  }

  it('round trips with warpPolar', () => {
    const original = [1, PI_OVER_5] as Polar;
    const warped = warpPolar(original);
    const unwarped = unwarpPolar(warped);
    expect(unwarped[0]).toBeCloseTo(original[0]);
    expect(unwarped[1]).toBeCloseTo(original[1]);
  });
});

describe('warpBeta', () => {
  const TEST_VALUES = [
    {input: 0, expected: 0},
    {input: 0.1, expected: 0.09657},
    {input: -0.2, expected: -0.19366},
    {input: PI_OVER_10, expected: 0.30579},
    {input: PI_OVER_5, expected: PI_OVER_5},
  ];

  for (const {input, expected} of TEST_VALUES) {
    it(`warpBeta(${input}) returns expected value`, () => {
      const result = warpBeta(input);
      expect(result).toBeCloseTo(expected, 4);
    });
  }

  it('is symmetric around zero', () => {
    const beta = PI_OVER_5;
    expect(warpBeta(beta)).toBeCloseTo(-warpBeta(-beta), 4);
  });

  it('preserves zero', () => {
    expect(warpBeta(0)).toBe(0);
  });

  for (const {input, expected} of TEST_VALUES) {
    it(`unwarpBeta(${expected}) returns expected value`, () => {
      const result = unwarpBeta(expected);
      expect(result).toBeCloseTo(input, 4);
    });
  }
 
  it('round trips with warpBeta', () => {
    const beta = 0.3;
    const warped = warpBeta(beta);
    const unwarped = unwarpBeta(warped);
    expect(unwarped).toBeCloseTo(beta, 4);
  });
 
  it('is symmetric around zero', () => {
    const beta = 0.2;
    expect(unwarpBeta(beta)).toBeCloseTo(-unwarpBeta(-beta), 4);
  });
 
  it('preserves zero', () => {
    expect(unwarpBeta(0)).toBe(0);
  });
});

describe('polar coordinates round trip', () => {
  it('tests all coordinates', () => {
   TEST_COORDS.forEach((coord, i) => {
      const polar = [coord.rho, coord.beta] as Polar;
      const warped = warpPolar(polar);
      const unwarped = unwarpPolar(warped);
      
      // Check that unwarped values are close to original
      expect(unwarped[0]).toBeCloseTo(polar[0]);
      expect(unwarped[1]).toBeCloseTo(polar[1]);
    });
  });
}); 
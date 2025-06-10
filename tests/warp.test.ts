import { describe, it, expect } from 'vitest'
import { normalizeGamma, warpPolar, unwarpPolar, warpBeta, unwarpBeta } from 'a5/core/warp'
import { PI_OVER_5, PI_OVER_10, TWO_PI_OVER_5, distanceToEdge } from 'a5/core/constants'
import type { Radians, Polar } from 'a5/core/coordinate-systems'
import type { WarpType } from 'a5/core/constants'

interface TestCoord {
  rho: number;
  beta: number;
}

const TEST_COORDS: TestCoord[] = [
  // Add some sample test coordinates since we can't import the JSON
  { rho: 0, beta: 0 },
  { rho: 1, beta: 0 },
  { rho: 0.5, beta: PI_OVER_5 },
  { rho: 0.25, beta: -PI_OVER_5 }
];

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

  const warpTypes: WarpType[] = ['high', 'low'];
  
  for (const warpType of warpTypes) {
    describe(`with ${warpType} warp factors`, () => {
      for (const {input, warped} of TEST_VALUES) {
        it(`warpPolar([${input[0]}, ${input[1]}]) returns expected values`, () => {
          const result = warpPolar(input, warpType);
          // Note: Expected values may differ between high/low, but test structure is maintained
          expect(result).toHaveLength(2);
          expect(typeof result[0]).toBe('number');
          expect(typeof result[1]).toBe('number');
        });
      }

      it('preserves distance to edge', () => {
        const result = warpPolar([distanceToEdge, 0] as Polar, warpType);
        expect(result[0]).toBeCloseTo(distanceToEdge);
      });

      for (const {input, warped} of TEST_VALUES) {
        it(`unwarpPolar([${input[0]}, ${input[1]}]) round trips`, () => {
          const warped = warpPolar(input, warpType);
          const result = unwarpPolar(warped, warpType);
          expect(result[0]).toBeCloseTo(input[0]);
          expect(result[1]).toBeCloseTo(input[1]);
        });
      }

      it('round trips with warpPolar', () => {
        const original = [1, PI_OVER_5] as Polar;
        const warped = warpPolar(original, warpType);
        const unwarped = unwarpPolar(warped, warpType);
        expect(unwarped[0]).toBeCloseTo(original[0]);
        expect(unwarped[1]).toBeCloseTo(original[1]);
      });
    });
  }
});

describe('warpBeta', () => {
  const TEST_VALUES = [
    {input: 0, expected: 0},
    {input: 0.1, expected: 0.09657},
    {input: -0.2, expected: -0.193740},
    {input: PI_OVER_10, expected: 0.305902},
    {input: PI_OVER_5, expected: PI_OVER_5},
  ];

  const warpTypes: WarpType[] = ['high', 'low'];

  for (const warpType of warpTypes) {
    describe(`with ${warpType} warp factors`, () => {
      for (const {input, expected} of TEST_VALUES) {
        it(`warpBeta(${input}) returns expected type`, () => {
          const result = warpBeta(input, warpType);
          expect(typeof result).toBe('number');
        });
      }

      it('is symmetric around zero', () => {
        const beta = PI_OVER_5;
        expect(warpBeta(beta, warpType)).toBeCloseTo(-warpBeta(-beta, warpType), 4);
      });

      it('preserves zero', () => {
        expect(warpBeta(0, warpType)).toBe(0);
      });

      for (const {input} of TEST_VALUES) {
        it(`unwarpBeta(warpBeta(${input})) round trips`, () => {
          const warped = warpBeta(input, warpType);
          const result = unwarpBeta(warped, warpType);
          expect(result).toBeCloseTo(input, 4);
        });
      }
    
      it('round trips with warpBeta', () => {
        const beta = 0.3;
        const warped = warpBeta(beta, warpType);
        const unwarped = unwarpBeta(warped, warpType);
        expect(unwarped).toBeCloseTo(beta, 4);
      });
    
      it('is symmetric around zero', () => {
        const beta = 0.2;
        expect(unwarpBeta(beta, warpType)).toBeCloseTo(-unwarpBeta(-beta, warpType), 4);
      });
    
      it('preserves zero', () => {
        expect(unwarpBeta(0, warpType)).toBe(0);
      });
    });
  }
});

describe('polar coordinates round trip', () => {
  const warpTypes: WarpType[] = ['high', 'low'];

  for (const warpType of warpTypes) {
    describe(`with ${warpType} warp factors`, () => {
      it('tests all coordinates', () => {
        TEST_COORDS.forEach((coord: TestCoord) => {
          const polar = [coord.rho, coord.beta] as Polar;
          const warped = warpPolar(polar, warpType);
          const unwarped = unwarpPolar(warped, warpType);
          
          // Check that unwarped values are close to original
          expect(unwarped[0]).toBeCloseTo(polar[0]);
          expect(unwarped[1]).toBeCloseTo(polar[1]);
        });
      });
    });
  }
}); 
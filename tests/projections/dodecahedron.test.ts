import { describe, it, expect } from 'vitest'
import { DodecahedronProjection } from 'a5/projections/dodecahedron'
import { origins } from 'a5/core/origin'
import type { Face, Radians, Polar } from 'a5/core/coordinate-systems'
import { toFace } from 'a5/core/coordinate-transforms'
import { PI_OVER_5, TWO_PI_OVER_5 } from 'a5/core/constants'
import TEST_COORDS from '../test-polar-coordinates.json'

interface TestCoord {
  rho: number;
  beta: number;
}

const dodecahedron = new DodecahedronProjection();

describe('Dodecahedron projection round trip', () => {
  const resolutions = [1, 2, 3, 4, 5, 6];

  for (const resolution of resolutions) {
    describe(`with resolution ${resolution}`, () => {
      it('round trip test', () => {
        origins.forEach((origin) => {
          (TEST_COORDS as TestCoord[]).forEach(({rho, beta}) => {
            const face = toFace([rho, beta as Radians] as Polar);
            const spherical = dodecahedron.inverse(face, origin.id, resolution);
            const result = dodecahedron.forward(spherical, origin.id, resolution);
            expect(result[0]).toBeCloseTo(face[0]);
            expect(result[1]).toBeCloseTo(face[1]);
          });
        });
      }); 
    });
  }
});

describe('normalizeGamma', () => {
  const TEST_VALUES = [
    {gamma: 0.1, normalized: 0.1},
    {gamma: 0.2, normalized: 0.2},
    {gamma: -0.2, normalized: -0.2},
    {gamma: 1.2, normalized: 1.2 - TWO_PI_OVER_5},
  ] as {gamma: Radians, normalized: number}[];

  for (const {gamma, normalized} of TEST_VALUES) {
    it(`normalizeGamma(${gamma}) = ${normalized}`, () => {
      const normalized2 = dodecahedron.normalizeGamma(gamma);
      expect(normalized2).toBeCloseTo(normalized);
    });
  }

  it('is periodic with period 2*PI_OVER_5', () => {
    const TEST_VALUES = [-0.977, -0.72, 0.3, 0, 0.01, 0.14, 0.333, 0.5, 0.6198123, 0.77, 0.9];
    for (const value of TEST_VALUES) {
      const gamma1 = (value * PI_OVER_5) as Radians;
      const gamma2 = (gamma1 + 2 * PI_OVER_5) as Radians;
      const normalized1 = dodecahedron.normalizeGamma(gamma1);
      const normalized2 = dodecahedron.normalizeGamma(gamma2);
      expect(normalized1).toBeCloseTo(normalized2);
    }
  });
});
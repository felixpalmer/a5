import { describe, it, expect } from 'vitest'
import { projectDodecahedron, unprojectDodecahedron } from 'a5/core/dodecahedron'
import { origins } from 'a5/core/origin'
import type { Polar } from 'a5/core/coordinate-systems'
import TEST_COORDS from './test-polar-coordinates.json'

interface TestCoord {
  rho: number;
  beta: number;
}

describe('Dodecahedron projection round trip', () => {
  const resolutions = [1, 2, 3, 4, 5, 6];

  for (const resolution of resolutions) {
    describe(`with resolution ${resolution}`, () => {
      it('round trip test', () => {
        origins.forEach((origin) => {
          (TEST_COORDS as TestCoord[]).forEach(({rho, beta}) => {
            const polar = [rho, beta] as Polar;
            const spherical = projectDodecahedron(polar, origin.quat, origin.angle, resolution);
            const result = unprojectDodecahedron(spherical, origin.quat, origin.angle, resolution);
            expect(result[0]).toBeCloseTo(polar[0]);
            expect(result[1]).toBeCloseTo(polar[1]);
          });
        });
      }); 
    });
  }
});
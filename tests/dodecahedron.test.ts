import { describe, it, expect } from 'vitest'
import { projectDodecahedron, unprojectDodecahedron } from 'a5/core/dodecahedron'
import { origins } from 'a5/core/origin'
import type { Polar } from 'a5/core/coordinate-systems'
import TEST_COORDS from './test-polar-coordinates.json';

describe('Dodecahedron projection round trip', () => {
  it('round trip test', () => {
    origins.forEach((origin) => {
      TEST_COORDS.forEach(({rho, beta}, i) => {
        const polar = [rho, beta] as Polar;
        const spherical = projectDodecahedron(polar, origin.quat, origin.angle);
        const result = unprojectDodecahedron(spherical, origin.quat, origin.angle);
        expect(result[0]).toBeCloseTo(polar[0]);
        expect(result[1]).toBeCloseTo(polar[1]);
      });
    });
  }); 
});
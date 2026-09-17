import * as vec3 from '../../modules/math/vec3';
import {describe, it, expect} from 'vitest';
import {EqualAreaProjection} from '../../modules/projections/equal-area';
import TEST_DATA from './fixtures/equal-area.json';
import {Cartesian} from '../../modules/core/coordinate-systems';

// Extract static data from test data
const {TEST_SPHERICAL_TRIANGLE, TEST_FACE_TRIANGLE} = TEST_DATA.static;

const AUTHALIC_RADIUS = 6371.0072; // km
const MAX_ANGLE = Math.max(
  vec3.angle(TEST_SPHERICAL_TRIANGLE[0] as Cartesian, TEST_SPHERICAL_TRIANGLE[1] as Cartesian),
  vec3.angle(TEST_SPHERICAL_TRIANGLE[1] as Cartesian, TEST_SPHERICAL_TRIANGLE[2] as Cartesian),
  vec3.angle(TEST_SPHERICAL_TRIANGLE[2] as Cartesian, TEST_SPHERICAL_TRIANGLE[0] as Cartesian)
);
const MAX_ARC_LENGTH_MM = AUTHALIC_RADIUS * MAX_ANGLE * 1e9;
const DESIRED_MM_PRECISION = 0.0024;

describe('EqualAreaProjection forward', () => {
  const equalArea = new EqualAreaProjection(TEST_SPHERICAL_TRIANGLE as any);
  let largestError = 0;

  it('forward projections', () => {
    TEST_DATA.forward.forEach((testCase, index) => {
      const result = equalArea.forward(
        testCase.input as any,
        TEST_SPHERICAL_TRIANGLE as any,
        TEST_FACE_TRIANGLE as any
      );
      expect(result).toBeCloseToArray(testCase.expected as number[]);
    });
  });

  it('round trip forward projections', () => {
    TEST_DATA.forward.forEach((testCase, index) => {
      const spherical = testCase.input as any;
      const polar = equalArea.forward(spherical, TEST_SPHERICAL_TRIANGLE as any, TEST_FACE_TRIANGLE as any);
      const result = equalArea.inverse(polar, TEST_FACE_TRIANGLE as any, TEST_SPHERICAL_TRIANGLE as any);
      largestError = Math.max(largestError, vec3.distance(result, spherical));
      expect(result).toBeCloseToArray(spherical);
    });
  });

  it(`is accurate to ${DESIRED_MM_PRECISION}mm`, () => {
    expect(largestError * MAX_ARC_LENGTH_MM).toBeLessThan(DESIRED_MM_PRECISION);
  });
});

describe('EqualAreaProjection triangle constants', () => {
  // The projection caches constants from one canonical triangle and reuses them
  // for every face. That is valid because all dodecahedron face triangles are
  // congruent and consistently wound:
  //   - volumeABC and areaABC are identical on every face (forward relies on this);
  //   - A·B / A·C only ever take the two canonical values — they are equal for
  //     "even" faces and swapped for the mirror-image "odd" faces, which
  //     inverse() handles by swapping B↔C — so on even faces the cached
  //     alphaTransform matrix matches exactly.
  it('agree across all face triangles, origins and reflections', async () => {
    const {DodecahedronProjection} = await import('../../modules/projections/dodecahedron');
    const {CRS} = await import('../../modules/projections/crs');
    const dodecahedron = new DodecahedronProjection() as any;
    const canonical = EqualAreaProjection.computeConstants(new CRS().getCanonicalTriangle());

    for (let originId = 0; originId < 12; originId++) {
      for (let faceTriangleIndex = 0; faceTriangleIndex < 10; faceTriangleIndex++) {
        for (const reflected of [false, true]) {
          const triangle = dodecahedron.getSphericalTriangle(faceTriangleIndex, originId, reflected);
          const c = EqualAreaProjection.computeConstants(triangle);
          const where = `face ${faceTriangleIndex}, origin ${originId}, reflected ${reflected}`;

          // Invariant on every face.
          expect(c.volumeABC, `volumeABC at ${where}`).toBeCloseTo(canonical.volumeABC, 12);
          expect(c.areaABC, `areaABC at ${where}`).toBeCloseTo(canonical.areaABC, 12);

          // A·B / A·C take the two canonical values; the orientation is whichever
          // canonical value A·B is nearer to (the same test inverse() uses).
          const even = Math.abs(c.AdotB - canonical.AdotB) < Math.abs(c.AdotB - canonical.AdotC);
          if (even) {
            expect(c.AdotB, `A·B at ${where}`).toBeCloseTo(canonical.AdotB, 12);
            expect(c.AdotC, `A·C at ${where}`).toBeCloseTo(canonical.AdotC, 12);
            // The cached coefficient matrix matches exactly on even faces.
            expect([...c.alphaTransform]).toBeCloseToArray([...canonical.alphaTransform]);
          } else {
            // Mirror-image face: A·B and A·C swapped (inverse() swaps B↔C).
            expect(c.AdotB, `A·B at ${where}`).toBeCloseTo(canonical.AdotC, 12);
            expect(c.AdotC, `A·C at ${where}`).toBeCloseTo(canonical.AdotB, 12);
          }
        }
      }
    }
  });
});

describe('EqualAreaProjection inverse', () => {
  const equalArea = new EqualAreaProjection(TEST_SPHERICAL_TRIANGLE as any);

  it('inverse projections', () => {
    TEST_DATA.inverse.forEach((testCase, index) => {
      const result = equalArea.inverse(
        testCase.input as any,
        TEST_FACE_TRIANGLE as any,
        TEST_SPHERICAL_TRIANGLE as any
      );
      expect(result).toBeCloseToArray(testCase.expected as number[]);
    });
  });

  it('round trip inverse projections', () => {
    TEST_DATA.inverse.forEach((testCase, index) => {
      const facePoint = testCase.input as any;
      const spherical = equalArea.inverse(facePoint, TEST_FACE_TRIANGLE as any, TEST_SPHERICAL_TRIANGLE as any);
      const result = equalArea.forward(spherical, TEST_SPHERICAL_TRIANGLE as any, TEST_FACE_TRIANGLE as any);
      expect(result).toBeCloseToArray(facePoint);
    });
  });
});

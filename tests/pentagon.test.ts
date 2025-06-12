import { describe, it, expect } from 'vitest'
import { 
  A, B, C, D, E,           // Pentagon angles
  a, b, c, d, e,           // Pentagon vertices
  PENTAGON,                 // Pentagon shape
  u, v, w,                 // Triangle vertices
  V,                       // Triangle angle
  TRIANGLE,                // Triangle shape
  BASIS,                   // Basis matrix
  BASIS_INVERSE            // Inverse basis matrix
} from 'a5/core/pentagon'
import { vec2, mat2 } from 'gl-matrix'

describe('pentagon.ts', () => {
  describe('pentagon angles', () => {
    it('has correct angle values', () => {
      expect(A).toBe(72);
      expect(B).toBe(127.94543761193603);
      expect(C).toBe(108);
      expect(D).toBe(82.29202980963508);
      expect(E).toBe(149.7625318412527);
    });
  });

  describe('pentagon vertices', () => {
    it('has correct vertex coordinates', () => {
      // Vertex a
      expect(a[0]).toBeCloseTo(0, 10);
      expect(a[1]).toBeCloseTo(0, 10);

      // Vertex b
      expect(b[0]).toBeCloseTo(0.1993818474311588, 10);
      expect(b[1]).toBeCloseTo(0.3754138223914238, 10);

      // Vertex c
      expect(c[0]).toBeCloseTo(0.6180339887498949, 10);
      expect(c[1]).toBeCloseTo(0.4490279765795854, 10);

      // Vertex d
      expect(d[0]).toBeCloseTo(0.8174158361810537, 10);
      expect(d[1]).toBeCloseTo(0.0736141541881617, 10);

      // Vertex e
      expect(e[0]).toBeCloseTo(0.418652141318736, 10);
      expect(e[1]).toBeCloseTo(-0.07361415418816161, 10);
    });
  });

  describe('pentagon shape', () => {
    it('has correct vertices', () => {
      const expected = [
        [0, 0],
        [0.1993818474311588, 0.3754138223914238],
        [0.6180339887498949, 0.4490279765795854],
        [0.8174158361810537, 0.0736141541881617],
        [0.418652141318736, -0.07361415418816161]
      ];

      const vertices = PENTAGON.getVertices();
      vertices.forEach((vertex, i) => {
        expect(vertex[0]).toBeCloseTo(expected[i][0], 10);
        expect(vertex[1]).toBeCloseTo(expected[i][1], 10);
      });
    });
  });

  describe('triangle vertices', () => {
    it('has correct vertex coordinates', () => {
      // Vertex u
      expect(u[0]).toBeCloseTo(0, 10);
      expect(u[1]).toBeCloseTo(0, 10);

      // Vertex v
      expect(v[0]).toBeCloseTo(0.6180339887498949, 10);
      expect(v[1]).toBeCloseTo(0.4490279765795854, 10);

      // Vertex w
      expect(w[0]).toBeCloseTo(0.6180339887498949, 10);
      expect(w[1]).toBeCloseTo(-0.4490279765795854, 10);

      // Angle V
      expect(V).toBe(0.6283185307179586);
    });
  });

  describe('triangle shape', () => {
    it('has correct vertices', () => {
      const expected = [
        [0, 0],
        [0.6180339887498949, 0.4490279765795854],
        [0.6180339887498949, -0.4490279765795854]
      ];

      const vertices = TRIANGLE.getVertices();
      vertices.forEach((vertex, i) => {
        expect(vertex[0]).toBeCloseTo(expected[i][0], 10);
        expect(vertex[1]).toBeCloseTo(expected[i][1], 10);
      });
    });
  });

  describe('basis matrices', () => {
    it('has correct basis and inverse', () => {
      const expectedBasis = [
        0.6180339887498949,
        0.4490279765795854,
        0.6180339887498949,
        -0.4490279765795854
      ];

      const expectedInverse = [
        0.8090169943749475,
        0.8090169943749475,
        1.1135163644116068,
        -1.1135163644116068
      ];

      Array.from(BASIS).forEach((value, i) => {
        expect(value).toBeCloseTo(expectedBasis[i], 10);
      });

      Array.from(BASIS_INVERSE).forEach((value, i) => {
        expect(value).toBeCloseTo(expectedInverse[i], 10);
      });

      // Verify BASIS * BASIS_INVERSE = Identity
      const product = mat2.create();
      mat2.multiply(product, BASIS, BASIS_INVERSE);
      expect(product[0]).toBeCloseTo(1, 10);
      expect(product[1]).toBeCloseTo(0, 10);
      expect(product[2]).toBeCloseTo(0, 10);
      expect(product[3]).toBeCloseTo(1, 10);
    });
  });
}); 
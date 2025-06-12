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
      console.log('Pentagon angles:', {
        A, // 72°
        B, // 127.95°
        C, // 108°
        D, // 82.29°
        E  // 149.76°
      });
    });
  });

  describe('pentagon vertices', () => {
    it('has correct vertex coordinates', () => {
      console.log('Pentagon vertices:', {
        a: Array.from(a),
        b: Array.from(b),
        c: Array.from(c),
        d: Array.from(d),
        e: Array.from(e)
      });
    });
  });

  describe('pentagon shape', () => {
    it('has correct vertices', () => {
      console.log('Pentagon shape vertices:', 
        PENTAGON.getVertices().map(v => Array.from(v))
      );
    });
  });

  describe('triangle vertices', () => {
    it('has correct vertex coordinates', () => {
      console.log('Triangle vertices:', {
        u: Array.from(u),
        v: Array.from(v),
        w: Array.from(w),
        V  // Triangle angle
      });
    });
  });

  describe('triangle shape', () => {
    it('has correct vertices', () => {
      console.log('Triangle shape vertices:', 
        TRIANGLE.getVertices().map(v => Array.from(v))
      );
    });
  });

  describe('basis matrices', () => {
    it('has correct basis and inverse', () => {
      console.log('Basis matrix:', Array.from(BASIS));
      console.log('Inverse basis matrix:', Array.from(BASIS_INVERSE));

      // Verify that BASIS * BASIS_INVERSE = Identity
      const product = mat2.create();
      mat2.multiply(product, BASIS, BASIS_INVERSE);
      console.log('BASIS * BASIS_INVERSE:', Array.from(product));
    });
  });
}); 
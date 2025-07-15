import { describe, it, expect } from 'vitest'
import { SphericalTriangleShape } from 'a5/geometry/spherical-triangle'
import type { Cartesian } from 'a5/core/coordinate-systems'
import { vec3 } from 'gl-matrix'
import fixtures from './fixtures/spherical-triangle.json'

describe('spherical-triangle.ts', () => {
  describe('constructor', () => {
    it('requires exactly 3 vertices', () => {
      expect(() => new SphericalTriangleShape([])).toThrow('SphericalTriangleShape requires exactly 3 vertices');
      expect(() => new SphericalTriangleShape([[1,0,0] as Cartesian, [0,1,0] as Cartesian])).toThrow('SphericalTriangleShape requires exactly 3 vertices');
      expect(() => new SphericalTriangleShape([[1,0,0] as Cartesian, [0,1,0] as Cartesian, [0,0,1] as Cartesian, [1,1,1] as Cartesian])).toThrow('SphericalTriangleShape requires exactly 3 vertices');
    });

    it('accepts exactly 3 vertices', () => {
      expect(() => new SphericalTriangleShape([[1,0,0] as Cartesian, [0,1,0] as Cartesian, [0,0,1] as Cartesian])).not.toThrow();
    });
  });

  describe('getBoundary', () => {
    it('returns boundary points with different segment counts', () => {
      (fixtures as any[]).forEach((fixture: any, i: number) => {
        const triangle = new SphericalTriangleShape(fixture.vertices as Cartesian[]);
        
        // Test boundaries with 1-3 segments
        [1, 2, 3].forEach(nSegments => {
          const boundary = triangle.getBoundary(nSegments, true);
          const expectedBoundary = fixture[`boundary${nSegments}`];
          expect(boundary.length).toBe(expectedBoundary.length);
          boundary.forEach((point: any, j: number) => {
            expect(point).toBeCloseToArray(expectedBoundary[j], 6);
          });
        });
      });
    });
  });

  describe('slerp', () => {
    it('interpolates between vertices', () => {
      (fixtures as any[]).forEach((fixture: any) => {
        const triangle = new SphericalTriangleShape(fixture.vertices as Cartesian[]);
        
        fixture.slerpTests.forEach(({ t, result }: any) => {
          const actual = triangle.slerp(t);
          expect(actual).toBeCloseToArray(result, 6);
          // Should be normalized
          expect(Math.abs(vec3.length(actual) - 1)).toBeLessThan(1e-10);
        });
      });
    });
  });

  describe('containsPoint', () => {
    it('correctly identifies points inside and outside triangle', () => {
      (fixtures as any[]).forEach((fixture: any) => {
        const triangle = new SphericalTriangleShape(fixture.vertices as Cartesian[]);
        
        fixture.containsPointTests.forEach(({ point, result }: any) => {
          const actual = triangle.containsPoint(point as Cartesian);
          expect(actual).toBeCloseTo(result, 6);
        });
      });
    });
  });

  describe('getArea', () => {
    it('returns correct area for all triangles', () => {
      (fixtures as any[]).forEach((fixture: any) => {
        const triangle = new SphericalTriangleShape(fixture.vertices as Cartesian[]);
        const area = triangle.getArea();
        expect(area).toBeCloseTo(fixture.area, 6);
        // Area can be negative for some winding orders, so check absolute value
        expect(Math.abs(area)).toBeGreaterThan(0);
        expect(Math.abs(area)).toBeLessThanOrEqual(2 * Math.PI);
      });
    });
  });
}); 
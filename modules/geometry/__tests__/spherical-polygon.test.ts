import { describe, it, expect } from 'vitest'
import { SphericalPolygonShape, type SphericalPolygon } from 'a5/geometry/spherical-polygon'
import type { Cartesian } from 'a5/core/coordinate-systems'
import { vec3 } from 'gl-matrix'
import fixtures from './fixtures/spherical-polygon.json'

describe('spherical-polygon.ts', () => {
  // Helper function to convert object with "0", "1", "2" properties to array
  function objToArray(obj: any): number[] {
    if (Array.isArray(obj)) return obj;
    return [obj["0"], obj["1"], obj["2"]];
  }

  describe('getBoundary', () => {
    it('returns boundary points with different segment counts', () => {
      (fixtures as any[]).forEach((fixture: any, i: number) => {
        const polygon = new SphericalPolygonShape(fixture.vertices as Cartesian[]);
        
        // Test boundary with 1 segment
        const boundary1 = polygon.getBoundary(1, true);
        expect(boundary1.length).toBe(fixture.boundary1.length);
        boundary1.forEach((point: any, j: number) => {
          const expected = objToArray(fixture.boundary1[j]);
          expect(point).toBeCloseToArray(expected, 6);
        });

        // Test boundary with 2 segments
        const boundary2 = polygon.getBoundary(2, true);
        expect(boundary2.length).toBe(fixture.boundary2.length);
        boundary2.forEach((point: any, j: number) => {
          const expected = objToArray(fixture.boundary2[j]);
          expect(point).toBeCloseToArray(expected, 6);
        });

        // Test boundary with 3 segments
        const boundary3 = polygon.getBoundary(3, true);
        expect(boundary3.length).toBe(fixture.boundary3.length);
        boundary3.forEach((point: any, j: number) => {
          const expected = objToArray(fixture.boundary3[j]);
          expect(point).toBeCloseToArray(expected, 6);
        });
      });
    });
  });

  describe('slerp', () => {
    it('interpolates between vertices', () => {
      (fixtures as any[]).forEach((fixture: any) => {
        const polygon = new SphericalPolygonShape(fixture.vertices as Cartesian[]);
        
        fixture.slerpTests.forEach(({ t, result }: any) => {
          const actual = polygon.slerp(t);
          const expected = objToArray(result);
          expect(actual).toBeCloseToArray(expected, 6);
          // Should be normalized
          expect(Math.abs(vec3.length(actual) - 1)).toBeLessThan(1e-10);
        });
      });
    });
  });

  describe('containsPoint', () => {
    it('correctly identifies points inside and outside polygon', () => {
      (fixtures as any[]).forEach((fixture: any) => {
        const polygon = new SphericalPolygonShape(fixture.vertices as Cartesian[]);
        
        fixture.containsPointTests.forEach(({ point, result }: any) => {
          const actual = polygon.containsPoint(objToArray(point) as Cartesian);
          expect(actual).toBeCloseTo(result, 6);
        });
      });
    });
  });

  describe('getArea', () => {
    it('returns correct area for all polygons', () => {
      (fixtures as any[]).forEach((fixture: any) => {
        const polygon = new SphericalPolygonShape(fixture.vertices as Cartesian[]);
        const area = polygon.getArea();
        expect(area).toBeCloseTo(fixture.area, 6);
        // Area can be negative for some winding orders, so check absolute value
        expect(Math.abs(area)).toBeGreaterThan(0);
        expect(Math.abs(area)).toBeLessThanOrEqual(2 * Math.PI);
      });
    });

    it('returns 0 for degenerate polygons', () => {
      expect(new SphericalPolygonShape([]).getArea()).toBe(0);
      expect(new SphericalPolygonShape([[1,0,0] as Cartesian]).getArea()).toBe(0);
      expect(new SphericalPolygonShape([[1,0,0] as Cartesian, [0,1,0] as Cartesian]).getArea()).toBe(0);
    });
  });
}); 
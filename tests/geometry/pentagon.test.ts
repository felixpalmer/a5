import { describe, it, expect } from 'vitest'
import { Pentagon, PentagonShape } from 'a5/geometry/pentagon'
import { normalizeLongitudes, type Contour } from 'a5/core/coordinate-transforms'
import type { Degrees, LonLat } from 'a5/core/coordinate-systems'
import fixtures from './fixtures/pentagon.json'

describe('PentagonShape', () => {
  describe('containsPoint', () => {
    it('returns correct results for all test cases', () => {
      (fixtures as any[]).forEach((fixture: any) => {
        const pentagon = new PentagonShape(fixture.vertices as Pentagon);
        
        fixture.containsPointTests.forEach(({ point, result }: any) => {
          const actual = pentagon.containsPoint(point);
          expect(actual).toBeCloseTo(result, 6);
        });
      });
    });

    it('handles edge cases correctly', () => {
      // Create a simple pentagon for testing
      const pentagon = new PentagonShape([
        [0, 2],   // top
        [2, 1],   // upper right
        [1, -2],  // lower right
        [-1, -2], // lower left
        [-2, 1],  // upper left
      ] as Pentagon);

      // Points on vertices
      expect(pentagon.containsPoint([0, 2])).toBe(-1);
      expect(pentagon.containsPoint([1.9999, 0.9999])).toBe(-1);
      
      // Points on edges
      expect(pentagon.containsPoint([1, 1.49999])).toBe(-1);  // Right edge
      expect(pentagon.containsPoint([-1, 1.49999])).toBe(-1); // Left edge
    });
  });

  describe('getArea', () => {
    it('returns correct area for all pentagons', () => {
      (fixtures as any[]).forEach((fixture: any) => {
        const pentagon = new PentagonShape(fixture.vertices as Pentagon);
        const area = pentagon.getArea();
        expect(area).toBeCloseTo(fixture.area, 6);
      });
    });
  });

  describe('getCenter', () => {
    it('returns correct center for all pentagons', () => {
      (fixtures as any[]).forEach((fixture: any) => {
        const pentagon = new PentagonShape(fixture.vertices as Pentagon);
        const center = pentagon.getCenter();
        const expected = fixture.center;
        expect(center[0]).toBeCloseTo(expected[0], 6);
        expect(center[1]).toBeCloseTo(expected[1], 6);
      });
    });
  });

  describe('transformations', () => {
    it('scale transformation works correctly', () => {
      (fixtures as any[]).forEach((fixture: any) => {
        const pentagon = new PentagonShape(fixture.vertices as Pentagon);
        const scaled = pentagon.clone().scale(2);
        const vertices = scaled.getVertices();
        
        fixture.transformTests.scale.forEach((expected: any, i: number) => {
          expect(vertices[i][0]).toBeCloseTo(expected[0], 6);
          expect(vertices[i][1]).toBeCloseTo(expected[1], 6);
        });
      });
    });

    it('rotate180 transformation works correctly', () => {
      (fixtures as any[]).forEach((fixture: any) => {
        const pentagon = new PentagonShape(fixture.vertices as Pentagon);
        const rotated = pentagon.clone().rotate180();
        const vertices = rotated.getVertices();
        
        fixture.transformTests.rotate180.forEach((expected: any, i: number) => {
          expect(vertices[i][0]).toBeCloseTo(expected[0], 6);
          expect(vertices[i][1]).toBeCloseTo(expected[1], 6);
        });
      });
    });

    it('reflectY transformation works correctly', () => {
      (fixtures as any[]).forEach((fixture: any) => {
        const pentagon = new PentagonShape(fixture.vertices as Pentagon);
        const reflected = pentagon.clone().reflectY();
        const vertices = reflected.getVertices();
        
        fixture.transformTests.reflectY.forEach((expected: any, i: number) => {
          expect(vertices[i][0]).toBeCloseTo(expected[0], 6);
          expect(vertices[i][1]).toBeCloseTo(expected[1], 6);
        });
      });
    });

    it('translate transformation works correctly', () => {
      (fixtures as any[]).forEach((fixture: any) => {
        const pentagon = new PentagonShape(fixture.vertices as Pentagon);
        const translated = pentagon.clone().translate([1, 1]);
        const vertices = translated.getVertices();
        
        fixture.transformTests.translate.forEach((expected: any, i: number) => {
          expect(vertices[i][0]).toBeCloseTo(expected[0], 6);
          expect(vertices[i][1]).toBeCloseTo(expected[1], 6);
        });
      });
    });
  });

  describe('splitEdges', () => {
    it('splits edges correctly', () => {
      (fixtures as any[]).forEach((fixture: any) => {
        const pentagon = new PentagonShape(fixture.vertices as Pentagon);
        
        // Test 2 segments
        const split2 = pentagon.clone().splitEdges(2);
        const vertices2 = split2.getVertices();
        fixture.splitEdgesTests.segments2.forEach((expected: any, i: number) => {
          expect(vertices2[i][0]).toBeCloseTo(expected[0], 6);
          expect(vertices2[i][1]).toBeCloseTo(expected[1], 6);
        });

        // Test 3 segments
        const split3 = pentagon.clone().splitEdges(3);
        const vertices3 = split3.getVertices();
        fixture.splitEdgesTests.segments3.forEach((expected: any, i: number) => {
          expect(vertices3[i][0]).toBeCloseTo(expected[0], 6);
          expect(vertices3[i][1]).toBeCloseTo(expected[1], 6);
        });
      });
    });
  });

  describe('normalizeLongitudes', () => {
    it('handles simple contour without wrapping', () => {
      const contour: Contour = [
        [0, 0] as LonLat,
        [10, 0] as LonLat,
        [10, 10] as LonLat,
        [0, 10] as LonLat,
        [0, 0] as LonLat
      ];
      const normalized = normalizeLongitudes(contour);
      expect(normalized).toEqual(contour);
    });

    it.skip('normalizes contour crossing antimeridian', () => {
      const contour: Contour = [
        [170, 0] as LonLat,
        [175, 0] as LonLat,
        [180, 0] as LonLat,
        [-175, 0] as LonLat,  // This should become 185
        [-170, 0] as LonLat,  // This should become 190
      ];
      const normalized = normalizeLongitudes(contour);
      expect(normalized[3][0]).toBeCloseTo(185 as Degrees);
      expect(normalized[4][0]).toBeCloseTo(190 as Degrees);
    });

    it('normalizes contour crossing antimeridian in opposite direction', () => {
      const contour: Contour = [
        [-170, 0] as LonLat,
        [-175, 0] as LonLat,
        [-180, 0] as LonLat,
        [175, 0] as LonLat,   // This should become -185
        [170, 0] as LonLat,   // This should become -190
      ];
      const normalized = normalizeLongitudes(contour);
      expect(normalized[3][0]).toBeCloseTo(-185 as Degrees);
      expect(normalized[4][0]).toBeCloseTo(-190 as Degrees);
    });
  });
}) 
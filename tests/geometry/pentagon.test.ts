import { describe, it, expect } from 'vitest'
import { Pentagon, PentagonShape } from 'a5/geometry/pentagon'
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
    it('returns split edges with different segment counts', () => {
      (fixtures as any[]).forEach((fixture: any) => {
        const pentagon = new PentagonShape(fixture.vertices as Pentagon);
        
        // Test boundaries with 2-3 segments
        [2, 3].forEach(nSegments => {
          const split = pentagon.clone().splitEdges(nSegments);
          const vertices = split.getVertices();
          const expectedVertices = fixture.splitEdgesTests[`segments${nSegments}`];
          expect(vertices.length).toBe(expectedVertices.length);
          vertices.forEach((vertex: any, i: number) => {
            expect(vertex[0]).toBeCloseTo(expectedVertices[i][0], 6);
            expect(vertex[1]).toBeCloseTo(expectedVertices[i][1], 6);
          });
        });
      });
    });
  });
}); 
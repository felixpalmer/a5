import { describe, it, expect } from 'vitest'
import { Pentagon, PentagonShape } from 'a5/core/utils'
import { normalizeLongitudes, type Contour } from 'a5/core/coordinate-transforms'
import type { Degrees, LonLat } from 'a5/core/coordinate-systems'

describe('PentagonShape', () => {
  describe('containsPoint', () => {
    // Create a simple pentagon for testing
    const pentagon = new PentagonShape([
      [0, 2],   // top
      [2, 1],   // upper right
      [1, -2],  // lower right
      [-1, -2], // lower left
      [-2, 1],  // upper left
    ] as Pentagon);

    it('returns true for points inside pentagon', () => {
      // Test center
      expect(pentagon.containsPoint([0, 0])).toBe(-1)
      
      // Test points in different triangular regions
      expect(pentagon.containsPoint([0, 1.5])).toBe(-1)  // Upper triangle
      expect(pentagon.containsPoint([1, 0])).toBe(-1)    // Right triangle
      expect(pentagon.containsPoint([-1, 0])).toBe(-1)   // Left triangle
    })

    it('returns number outside pentagon', () => {
      // Test points clearly outside
      expect(pentagon.containsPoint([0, 3])).toBe(2)
      expect(pentagon.containsPoint([3, 0])).toBeCloseTo(2.82842)
      expect(pentagon.containsPoint([0, -3])).toBeCloseTo(1.41421)
      expect(pentagon.containsPoint([-3, 0])).toBeCloseTo(1.41421)
      
      // Test points just outside edges
      expect(pentagon.containsPoint([0, 2.1])).toBe(2)
      expect(pentagon.containsPoint([2.1, 1])).toBeCloseTo(0.042993)
    })

    it('handles edge cases correctly', () => {
      // Points on vertices
      expect(pentagon.containsPoint([0, 2])).toBe(-1)
      expect(pentagon.containsPoint([1.9999, 0.9999])).toBe(-1)
      
      // Points on edges
      expect(pentagon.containsPoint([1, 1.49999])).toBe(-1)  // Right edge
      expect(pentagon.containsPoint([-1, 1.49999])).toBe(-1) // Left edge
    })

    it('containsPointSmall', () => {
      const smallPentagon = new PentagonShape([
        [0.005584805117118508, 0.007421763173983242],
        [0.007142475800174408, 0.01035468366141623],
        [0.010413195654227048, 0.01092979424101126],
        [0.011970866337282948, 0.00799687375357827],
        [0.008855524971171091, 0.006846652594388214]
      ] as Pentagon);

      const redPoint = [ 0.008777835727200756, 0.007709318463780757 ];
      expect(smallPentagon.containsPoint(redPoint as any)).toBe(-1);
    });

    it('containsPointOnEdge', () => {
      // Singapore pentagon, resolution 4 (in Face coordiantes, origin 8)
      const singaporePentagon = new PentagonShape([
        [0.24999999999999994, -0.406149620291133],
        [0.1761431542833664, -0.48255778435927743],
        [0.19098300562505247, -0.5877852522924732],
        [0.29564604095473646, -0.6061887908395137],
        [0.2998454618577896, -0.500003075888989]
      ] as Pentagon);

      const singapore = [0.22395879916296305, -0.5770707674730963];
      expect(singaporePentagon.containsPoint(singapore as any)).toBe(-1);
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
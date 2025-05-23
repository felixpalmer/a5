import { describe, it, expect } from 'vitest'
import { Contour, Pentagon, PentagonShape } from 'a5/core/utils'
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
      expect(pentagon.containsPoint([0, 0])).toBe(true)
      
      // Test points in different triangular regions
      expect(pentagon.containsPoint([0, 1.5])).toBe(true)  // Upper triangle
      expect(pentagon.containsPoint([1, 0])).toBe(true)    // Right triangle
      expect(pentagon.containsPoint([-1, 0])).toBe(true)   // Left triangle
    })

    it('returns false for points outside pentagon', () => {
      // Test points clearly outside
      expect(pentagon.containsPoint([0, 3])).toBe(false)
      expect(pentagon.containsPoint([3, 0])).toBe(false)
      expect(pentagon.containsPoint([0, -3])).toBe(false)
      expect(pentagon.containsPoint([-3, 0])).toBe(false)
      
      // Test points just outside edges
      expect(pentagon.containsPoint([0, 2.1])).toBe(false)
      expect(pentagon.containsPoint([2.1, 1])).toBe(false)
    })

    it('handles edge cases correctly', () => {
      // Points on vertices
      expect(pentagon.containsPoint([0, 2])).toBe(true)
      expect(pentagon.containsPoint([1.9999, 0.9999])).toBe(true)
      
      // Points on edges
      expect(pentagon.containsPoint([1, 1.49999])).toBe(true)  // Right edge
      expect(pentagon.containsPoint([-1, 1.49999])).toBe(true) // Left edge
    })
  })

  describe('normalizeLongitudes', () => {
    it('handles simple contour without wrapping', () => {
      const contour: Contour = [
        [0, 0] as LonLat,
        [10, 0] as LonLat,
        [10, 10] as LonLat,
        [0, 10] as LonLat,
        [0, 0] as LonLat
      ];
      const normalized = PentagonShape.normalizeLongitudes(contour);
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
      const normalized = PentagonShape.normalizeLongitudes(contour);
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
      const normalized = PentagonShape.normalizeLongitudes(contour);
      expect(normalized[3][0]).toBeCloseTo(-185 as Degrees);
      expect(normalized[4][0]).toBeCloseTo(-190 as Degrees);
    });
  });
}) 
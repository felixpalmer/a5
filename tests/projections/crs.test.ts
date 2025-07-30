import { vec3 } from "gl-matrix";
import { describe, it, expect } from 'vitest';
import { CRS } from 'a5/projections/crs';
import type { Cartesian } from 'a5/core/coordinate-systems';
import expectedVertices from '../fixtures/crs-vertices.json';

describe('CRS', () => {
  it('should have exactly 62 vertices', () => {
    const crs = new CRS();
    const vertices = crs['vertices'] as Cartesian[];
    
    expect(vertices.length).toBe(62);
  });

  it('should match expected vertices from JSON file', () => {
    const crs = new CRS();
    const vertices = crs['vertices'] as Cartesian[];
    
    expect(vertices.length).toBe(expectedVertices.length);
    vertices.forEach((vertex, index) => {
      const expected = expectedVertices[index];
      expect(vertex).toBeCloseToArray(expected);
    });
  });

  it('should throw error for non-existent vertex', () => {
    const crs = new CRS();
    const nonVertexPoint = [1, 0, 0] as Cartesian;
    expect(() => crs.getVertex(nonVertexPoint)).toThrow('Failed to find vertex in CRS');
  });

  it('should validate vertex structure', () => {
    const crs = new CRS();
    const vertices = crs['vertices'] as Cartesian[];
    
    // All vertices should be normalized (unit length)
    vertices.forEach((vertex, index) => {
      expect(vec3.length(vertex)).toBeCloseTo(1, 15);
    });
  });
}); 
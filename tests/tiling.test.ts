import { describe, it, expect } from 'vitest';
import { getPentagonVertices, getQuintantVertices, getFaceVertices, getQuintantPolar } from 'a5/core/tiling';
import fixtures from './fixtures/tiling.json';
import type { Anchor } from 'a5/lattice';
import type { Polar } from 'a5/core/coordinate-systems';

describe('tiling', () => {
  describe('getPentagonVertices', () => {
    it('should generate pentagon vertices with correct properties', () => {
      fixtures.getPentagonVertices.forEach((testCase, index) => {
        const { input, output } = testCase;
        const { resolution, quintant, anchor } = input;
        
        const pentagon = getPentagonVertices(resolution, quintant, anchor as Anchor);
        const vertices = pentagon.getVertices();
        const area = pentagon.getArea();
        const center = pentagon.getCenter();
        
        // Check that vertices match (within floating point tolerance)
        expect(vertices).toHaveLength(output.vertices.length);
        vertices.forEach((vertex, i) => {
          expect(vertex[0]).toBeCloseTo(output.vertices[i][0], 15);
          expect(vertex[1]).toBeCloseTo(output.vertices[i][1], 15);
        });
        
        // Check area matches
        expect(area).toBeCloseTo(output.area, 15);
        
        // Check center matches
        expect(center[0]).toBeCloseTo(output.center[0], 15);
        expect(center[1]).toBeCloseTo(output.center[1], 15);
      });
    });
  });

  describe('getQuintantVertices', () => {
    it('should generate correct quintant vertices for all quintants', () => {
      fixtures.getQuintantVertices.forEach((testCase) => {
        const { input, output } = testCase;
        const { quintant } = input;
        
        const pentagon = getQuintantVertices(quintant);
        const vertices = pentagon.getVertices();
        const area = pentagon.getArea();
        const center = pentagon.getCenter();
        
        // Check that vertices match
        expect(vertices).toHaveLength(output.vertices.length);
        vertices.forEach((vertex, i) => {
          expect(vertex[0]).toBeCloseTo(output.vertices[i][0], 15);
          expect(vertex[1]).toBeCloseTo(output.vertices[i][1], 15);
        });
        
        // Check area matches
        expect(area).toBeCloseTo(output.area, 15);
        
        // Check center matches
        expect(center[0]).toBeCloseTo(output.center[0], 15);
        expect(center[1]).toBeCloseTo(output.center[1], 15);
      });
    });
  });

  describe('getFaceVertices', () => {
    it('should generate face vertices with correct properties', () => {
      const pentagon = getFaceVertices();
      const vertices = pentagon.getVertices();
      const area = pentagon.getArea();
      const center = pentagon.getCenter();
      
      const expected = fixtures.getFaceVertices;
      
      // Check that vertices match
      expect(vertices).toHaveLength(expected.vertices.length);
      vertices.forEach((vertex, i) => {
        expect(vertex[0]).toBeCloseTo(expected.vertices[i][0], 15);
        expect(vertex[1]).toBeCloseTo(expected.vertices[i][1], 15);
      });
      
      // Check area matches
      expect(area).toBeCloseTo(expected.area, 15);
      
      // Check center matches
      expect(center[0]).toBeCloseTo(expected.center[0], 15);
      expect(center[1]).toBeCloseTo(expected.center[1], 15);
    });
  });

  describe('getQuintantPolar', () => {
    it('should return correct quintant for polar coordinates', () => {
      fixtures.getQuintantPolar.forEach((testCase) => {
        const { input, output } = testCase;
        const { polar } = input;
        const { quintant } = output;

        const result = getQuintantPolar(polar as Polar);
        expect(result).toBe(quintant);
      });
    });
  });
});
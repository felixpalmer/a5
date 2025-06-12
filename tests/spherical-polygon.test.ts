import { describe, it, expect } from 'vitest'
import { SphericalPolygonShape, type SphericalPolygon } from 'a5/core/spherical-polygon'
import type { Cartesian } from 'a5/core/coordinate-systems'
import { vec3 } from 'gl-matrix'

describe('spherical-polygon.ts', () => {
  // Helper function to create normalized vectors
  function createNormalizedVector(x: number, y: number, z: number): Cartesian {
    const v = vec3.fromValues(x, y, z);
    vec3.normalize(v, v);
    return v as Cartesian;
  }

  const testPolygons: SphericalPolygon[] = [
    // Simple triangle near north pole
    [
      createNormalizedVector(0.1, 0, 0.9),
      createNormalizedVector(-0.05, 0.087, 0.9),
      createNormalizedVector(-0.05, -0.087, 0.9)
    ],
    // Pentagon around equator
    [
      createNormalizedVector(1, 0, 0),
      createNormalizedVector(0.309, 0.951, 0),
      createNormalizedVector(-0.809, 0.588, 0),
      createNormalizedVector(-0.809, -0.588, 0),
      createNormalizedVector(0.309, -0.951, 0)
    ]
  ];

  describe('getBoundary', () => {
    it('returns boundary points with different segment counts', () => {
      const testCases = testPolygons.map((vertices, i) => ({
        polygon: new SphericalPolygonShape(vertices),
        nSegments: i + 1,
        closedRing: true
      }));

      for (const testCase of testCases) {
        const result = testCase.polygon.getBoundary(testCase.nSegments, testCase.closedRing);
        console.log('getBoundary test case:', {
          input: {
            vertices: testCase.polygon['vertices'],
            nSegments: testCase.nSegments,
            closedRing: testCase.closedRing
          },
          output: result
        });
        // TODO: Add assertions once we have verified outputs
        expect(result).toBeDefined();
        if (testCase.closedRing) {
          expect(result[0]).toEqual(result[result.length - 1]);
        }
      }
    });
  });

  describe('slerp', () => {
    it('interpolates between vertices', () => {
      const testCases = testPolygons.map((vertices, i) => ({
        polygon: new SphericalPolygonShape(vertices),
        tValues: [0, 0.25, 0.5, 0.75, 1.0, 1.5]
      }));

      for (const testCase of testCases) {
        const results = testCase.tValues.map(t => {
          const result = testCase.polygon.slerp(t);
          return { t, result };
        });
        
        console.log('slerp test case:', {
          input: {
            vertices: testCase.polygon['vertices'],
            tValues: testCase.tValues
          },
          output: results
        });
        // TODO: Add assertions once we have verified outputs
        results.forEach(({ result }) => {
          expect(result).toBeDefined();
          expect(result.length).toBe(3);
          // Should be normalized
          expect(Math.abs(vec3.length(result) - 1)).toBeLessThan(1e-10);
        });
      }
    });
  });

  describe('containsPoint', () => {
    it('correctly identifies points inside and outside polygon', () => {
      const testCases = testPolygons.map((vertices) => {
        const polygon = new SphericalPolygonShape(vertices);
        // Test points: center of first edge, center point, and point far from polygon
        const points = [
          polygon.slerp(0.5), // Point on edge
          createNormalizedVector(0, 0, 1), // North pole
          createNormalizedVector(0, 0, -1), // South pole
        ];
        return { polygon, points };
      });

      for (const testCase of testCases) {
        const results = testCase.points.map(point => {
          const result = testCase.polygon.containsPoint(point);
          return { point, result };
        });
        
        console.log('containsPoint test case:', {
          input: {
            vertices: testCase.polygon['vertices'],
            points: testCase.points
          },
          output: results
        });
        // TODO: Add assertions once we have verified outputs
        results.forEach(({ result }) => {
          expect(typeof result).toBe('number');
        });
      }
    });
  });
}); 
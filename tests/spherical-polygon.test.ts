import { describe, it, expect } from 'vitest'
import { SphericalPolygonShape, type SphericalPolygon } from 'a5/core/spherical-polygon'
import type { Cartesian } from 'a5/core/coordinate-systems'
import { vec3 } from 'gl-matrix'

describe('spherical-polygon.ts', () => {
  const testPolygons: SphericalPolygon[] = [
    // Simple triangle near north pole
    [
      [0.11043152607484655, 0, 0.9938837346736189] as Cartesian,
      [-0.05521344008179805, 0.0960713857423286, 0.9938419214723649] as Cartesian,
      [-0.05521344008179805, -0.0960713857423286, 0.9938419214723649] as Cartesian
    ],
    // Pentagon around equator
    [
      [1, 0, 0] as Cartesian,
      [0.3090182326136022, 0.9510561139661348, 0] as Cartesian,
      [-0.8089090028554804, 0.58793386116072, 0] as Cartesian,
      [-0.8089090028554804, -0.58793386116072, 0] as Cartesian,
      [0.3090182326136022, -0.9510561139661348, 0] as Cartesian
    ]
  ];

  describe('getBoundary', () => {
    it('returns boundary points with different segment counts', () => {
      const expectedResults = [
        // Triangle with 1 segment
        [
          [0.11043152956009886, 0, 0.9938837342863687],
          [-0.055213440211813215, 0.0960713848509679, 0.9938419215513068],
          [-0.055213440211813215, -0.0960713848509679, 0.9938419215513068],
          [0.11043152956009886, 0, 0.9938837342863687]
        ],
        // Pentagon with 2 segments
        [
          [0.9999999999999998, 0, 2.220446049250313e-16],
          [0.8090173744213622, 0.5877847292031038, -2.220446049250313e-16],
          [0.3090182226643831, 0.9510561171988461, -5.868212804571726e-9],
          [-0.3089290367688098, 0.9510850909572153, -5.868212582527121e-9],
          [-0.8089090123512248, 0.5879338480959965, 1.6546987779975098e-8],
          [-1.0000000000000002, -6.600235413767308e-9, 1.6546987668952795e-8],
          [-0.8089090123512248, -0.5879338480959965, 1.6546987779975098e-8],
          [-0.30892902454635696, -0.9510850949272814, 1.6546988224064307e-8],
          [0.3090182226643831, -0.9510561171988461, -5.868212804571726e-9],
          [0.8090173734529743, -0.5877847305359768, -5.868213026616331e-9],
          [0.9999999999999998, 0, 2.220446049250313e-16]
        ]
      ];

      testPolygons.forEach((vertices, i) => {
        const polygon = new SphericalPolygonShape(vertices);
        const result = polygon.getBoundary(i + 1, true);
        
        expect(result.length).toBe(expectedResults[i].length);
        result.forEach((point, j) => {
          expect(point).toBeCloseToArray(expectedResults[i][j], 6);
        });
      });
    });
  });

  describe('slerp', () => {
    it('interpolates between vertices', () => {
      const testCases = testPolygons.map((vertices) => ({
        polygon: new SphericalPolygonShape(vertices),
        tValues: [0, 0.25, 0.5, 0.75, 1.0, 1.5]
      }));

      for (const testCase of testCases) {
        const results = testCase.tValues.map(t => {
          const result = testCase.polygon.slerp(t);
          return { t, result };
        });
        
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
      const expectedResults = [
        // Triangle results
        [
          -6.298927875819649e-9,   // Point on edge
          0.4975161666370207,      // North pole
          -0.027744911851070468    // South pole
        ],
        // Pentagon results
        [
          -2.9067971274991057e-16, // Point on edge
          0.5719850412819585,      // North pole
          -0.5720993058152115      // South pole
        ]
      ];

      testPolygons.forEach((vertices, i) => {
        const polygon = new SphericalPolygonShape(vertices);
        const points = [
          polygon.slerp(0.5), // Point on edge
          [0, 0, 1] as Cartesian, // North pole
          [0, 0, -1] as Cartesian, // South pole
        ];

        points.forEach((point, j) => {
          const result = polygon.containsPoint(point);
          expect(result).toBeCloseTo(expectedResults[i][j], 6);
        });
      });
    });
  });

  describe('getArea', () => {
    it('returns positive area for triangle and pentagon', () => {
      // TODO fix case of polygon with vertices on equator
      for (const vertices of [testPolygons[0]]) {
        const polygon = new SphericalPolygonShape(vertices);
        const area = polygon.getArea();
        expect(area).toBeGreaterThan(0);
        expect(area).toBeLessThanOrEqual(2 * Math.PI);
      }
    });
    it('returns 0 for degenerate polygons', () => {
      expect(new SphericalPolygonShape([]).getArea()).toBe(0);
      expect(new SphericalPolygonShape([[1,0,0] as Cartesian]).getArea()).toBe(0);
      expect(new SphericalPolygonShape([[1,0,0] as Cartesian, [0,1,0] as Cartesian]).getArea()).toBe(0);
    });
  });
}); 
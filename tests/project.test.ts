import { describe, it, expect } from 'vitest'
import { projectPoint, projectPentagon } from 'a5/core/project'
import { PentagonShape } from 'a5/core/utils'
import { origins } from 'a5/core/origin'
import type { Face, LonLat } from 'a5/core/coordinate-systems'
import { vec2 } from 'gl-matrix'

describe('project.ts', () => {
  describe('projectPoint', () => {
    it('projects points from different faces', () => {
      const testCases = [
        {
          vertex: [1.0, 0.0] as Face,
          origin: origins[0],
          resolution: 1,
          expected: [-93, 38.68195943554304]
        },
        {
          vertex: [0.0, 1.0] as Face,
          origin: origins[1],
          resolution: 2,
          expected: [-32.95846891893504, 45.251163281983025]
        },
        {
          vertex: [-0.5, 0.5] as Face,
          origin: origins[2],
          resolution: 3,
          expected: [-32.3123071481169, 0.8320967050080308]
        }
      ];

      for (const testCase of testCases) {
        const result = projectPoint(testCase.vertex, testCase.origin, testCase.resolution);
        expect(result[0]).toBeCloseTo(testCase.expected[0], 6);
        expect(result[1]).toBeCloseTo(testCase.expected[1], 6);
      }
    });
  });

  describe('projectPentagon', () => {
    it('projects pentagons from different faces', () => {
      const testCases = [
        {
          pentagon: new PentagonShape([
            vec2.fromValues(1.0, 0.0) as Face,
            vec2.fromValues(0.309, 0.951) as Face,
            vec2.fromValues(-0.809, 0.588) as Face,
            vec2.fromValues(-0.809, -0.588) as Face,
            vec2.fromValues(0.309, -0.951) as Face,
          ]),
          origin: origins[0],
          resolution: 1,
          expected: [
            [-164.99991828414556, 38.68497101752417],
            [123.01142419979746, 38.676217006801735],
            [50.98857580020257, 38.676217006801735],
            [-21.000081715854407, 38.68497101752417],
            [-93, 38.68195943554304]
          ]
        },
        {
          pentagon: new PentagonShape([
            vec2.fromValues(0.5, 0.0) as Face,
            vec2.fromValues(0.154, 0.475) as Face,
            vec2.fromValues(-0.404, 0.294) as Face,
            vec2.fromValues(-0.404, -0.294) as Face,
            vec2.fromValues(0.154, -0.475) as Face,
          ]),
          origin: origins[1],
          resolution: 2,
          expected: [
            [-107.74707132624515, 5.298302558481599],
            [-121.74880868761667, 31.608092363052112],
            [-92.97005161996529, 52.22826407766257],
            [-64.27272477825645, 31.640683029484702],
            [-78.24780847310419, 5.260998102115636]
          ]
        }
      ];

      for (const testCase of testCases) {
        const result = projectPentagon(testCase.pentagon, testCase.origin, testCase.resolution);
        
        // Verify each vertex of the pentagon
        for (let i = 0; i < result.length; i++) {
          expect(result[i][0]).toBeCloseTo(testCase.expected[i][0], 6);
          expect(result[i][1]).toBeCloseTo(testCase.expected[i][1], 6);
        }
      }
    });
  });
}); 
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
          resolution: 1
        },
        {
          vertex: [0.0, 1.0] as Face,
          origin: origins[1],
          resolution: 2
        },
        {
          vertex: [-0.5, 0.5] as Face,
          origin: origins[2],
          resolution: 3
        }
      ];

      for (const testCase of testCases) {
        const result = projectPoint(testCase.vertex, testCase.origin, testCase.resolution);
        console.log('projectPoint test case:', {
          input: {
            vertex: testCase.vertex,
            originId: testCase.origin.id,
            originAngle: testCase.origin.angle,
            resolution: testCase.resolution
          },
          output: result
        });
        // TODO: Add assertions once we have verified outputs
        expect(result).toBeDefined();
        expect(result.length).toBe(2);
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
          resolution: 1
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
          resolution: 2
        }
      ];

      for (const testCase of testCases) {
        const result = projectPentagon(testCase.pentagon, testCase.origin, testCase.resolution);
        console.log('projectPentagon test case:', {
          input: {
            vertices: testCase.pentagon.getVertices(),
            originId: testCase.origin.id,
            originAngle: testCase.origin.angle,
            resolution: testCase.resolution
          },
          output: result
        });
        // TODO: Add assertions once we have verified outputs
        expect(result).toBeDefined();
        expect(result.length).toBe(5);
      }
    });
  });
}); 
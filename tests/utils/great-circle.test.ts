import {describe, it, expect} from 'vitest';
import {sampleGreatCircleArc, greatCircleDistance} from 'a5/utils/great-circle';
import type {Cartesian} from 'a5/core/coordinate-systems';
import fixtures from '../fixtures/utils/great-circle.json';
import './matchers';

type Fixture = {
  name: string;
  a: [number, number];
  b: [number, number];
  aVec: number[];
  bVec: number[];
  sampleInterval: number;
  distance: number;
  sampleCount: number;
  samples: number[][];
};

describe('sampleGreatCircleArc', () => {
  for (const f of fixtures.sampleGreatCircleArc as Fixture[]) {
    it(`${f.name}`, () => {
      const aVec = f.aVec as unknown as Cartesian;
      const bVec = f.bVec as unknown as Cartesian;

      // Distance check is the cheapest signal that endpoints round-tripped.
      expect(greatCircleDistance(aVec, bVec)).toBeCloseTo(f.distance, 6);

      // Tolerance 6 matches the rest of the vector tests — gl-matrix defaults
      // to Float32 unless a sibling module has called setMatrixArrayType.
      const samples = sampleGreatCircleArc(aVec, bVec, f.sampleInterval);
      expect(samples.length).toBe(f.sampleCount);
      for (let i = 0; i < samples.length; i++) {
        expect([...samples[i]]).toBeCloseToArray(f.samples[i], 6);
      }
    });
  }
});

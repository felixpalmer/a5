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

type DistanceFixture = {
  name: string;
  aVec: number[];
  bVec: number[];
  distance: number;
};

describe('greatCircleDistance precision', () => {
  // Near-degenerate cases with analytically-known distances (Kahan §12):
  // acos(a·b) would fail these — it returns 0 for separations below ~1e-8 rad
  // and errs by ~0.1 m near the antipode. The stable 2·atan2 form must match
  // the analytic value to within 1e-10 relative (or 1e-9 m absolute near zero).
  for (const f of fixtures.distances as DistanceFixture[]) {
    it(`${f.name}`, () => {
      const d = greatCircleDistance(f.aVec as unknown as Cartesian, f.bVec as unknown as Cartesian);
      const tolerance = Math.max(1e-9, 1e-10 * f.distance);
      expect(Math.abs(d - f.distance)).toBeLessThanOrEqual(tolerance);
    });
  }
});

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

import { describe, it, expect } from 'vitest';
import { Spiral, SPIRAL_SAMPLE_COUNT } from 'a5/utils/spiral';
import type { Spherical } from 'a5/core/coordinate-systems';
import fixtures from '../fixtures/utils/spiral.json';
import './matchers';

type Fixture = {
  name: string;
  center: [number, number];
  scaleRad: number;
  sampleCount: number;
  samples: number[][];
};

describe('Spiral', () => {
  it('SPIRAL_SAMPLE_COUNT matches fixture', () => {
    expect(SPIRAL_SAMPLE_COUNT).toBe((fixtures as any).sampleCount);
  });

  for (const f of (fixtures as any).spiral as Fixture[]) {
    it(`${f.name}`, () => {
      const center = f.center as unknown as Spherical;
      const spiral = new Spiral(center, f.scaleRad);
      expect(f.sampleCount).toBe(SPIRAL_SAMPLE_COUNT);
      for (let i = 0; i < SPIRAL_SAMPLE_COUNT; i++) {
        const s = spiral.sample(i);
        expect([...s]).toBeCloseToArray(f.samples[i], 6);
      }
    });
  }
});

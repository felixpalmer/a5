import { describe, it, expect } from 'vitest';
import { generateSpiralSamples, SPIRAL_SAMPLE_COUNT } from 'a5/utils/spiral';
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

describe('generateSpiralSamples', () => {
  it('SPIRAL_SAMPLE_COUNT matches fixture', () => {
    expect(SPIRAL_SAMPLE_COUNT).toBe((fixtures as any).sampleCount);
  });

  for (const f of (fixtures as any).generateSpiralSamples as Fixture[]) {
    it(`${f.name}`, () => {
      const center = f.center as unknown as Spherical;
      const samples = generateSpiralSamples(center, f.scaleRad);
      expect(samples.length).toBe(f.sampleCount);
      for (let i = 0; i < samples.length; i++) {
        expect([...samples[i]]).toBeCloseToArray(f.samples[i], 6);
      }
    });
  }
});

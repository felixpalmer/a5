import { describe, it, expect } from 'vitest';
import type { IJ } from 'a5/core/coordinate-systems';
import type { Flip, Quaternary } from 'a5/lattice';
import { IJToQuaternary, quaternaryToKJ, quaternaryToFlips } from 'a5/lattice';
import fixtures from '../fixtures/lattice/quaternary.json';

type IJToQuaternaryFixture = {
  ij: [number, number];
  flips: [Flip, Flip];
  digit: Quaternary;
};

type QuaternaryToKJFixture = {
  q: Quaternary;
  flips: [Flip, Flip];
  kj: [number, number];
};

type QuaternaryToFlipsFixture = {
  q: Quaternary;
  flips: [Flip, Flip];
};

describe('IJToQuaternary', () => {
  it('produces correct digit for all test cases', () => {
    for (const f of fixtures.IJToQuaternary as IJToQuaternaryFixture[]) {
      const digit = IJToQuaternary(f.ij as IJ, f.flips);
      expect(
        digit,
        `ij=[${f.ij}] flips=[${f.flips}]`
      ).toBe(f.digit);
    }
  });
});

describe('quaternaryToKJ', () => {
  it('produces correct KJ for all test cases', () => {
    for (const f of fixtures.quaternaryToKJ as QuaternaryToKJFixture[]) {
      const kj = quaternaryToKJ(f.q, f.flips);
      expect(kj[0] || 0, `q=${f.q} flips=[${f.flips}] kj[0]`).toBe(f.kj[0]);
      expect(kj[1] || 0, `q=${f.q} flips=[${f.flips}] kj[1]`).toBe(f.kj[1]);
    }
  });
});

describe('quaternaryToFlips', () => {
  it('produces correct flips for all quaternary values', () => {
    for (const f of fixtures.quaternaryToFlips as QuaternaryToFlipsFixture[]) {
      const flips = quaternaryToFlips(f.q);
      expect(flips[0], `q=${f.q} flips[0]`).toBe(f.flips[0]);
      expect(flips[1], `q=${f.q} flips[1]`).toBe(f.flips[1]);
    }
  });
});

import { describe, it, expect } from 'vitest';
import type { IJ } from 'a5/core/coordinate-systems';
import type { Anchor, Flip, Orientation, Quaternary } from 'a5/lattice';
import { sToAnchor, anchorToS } from 'a5/lattice';
import fixtures from '../fixtures/lattice/hilbert.json';

type SToAnchorFixture = {
  s: number;
  resolution: number;
  orientation: Orientation;
  q: Quaternary;
  offset: [number, number];
  flips: [Flip, Flip];
};

describe('sToAnchor', () => {
  it('produces correct anchor for all test cases', () => {
    for (const f of fixtures.sToAnchor as SToAnchorFixture[]) {
      const anchor = sToAnchor(BigInt(f.s), f.resolution, f.orientation);
      expect(anchor.q, `q for s=${f.s} res=${f.resolution} ori=${f.orientation}`).toBe(f.q);
      expect(anchor.offset[0], `offset[0] for s=${f.s} res=${f.resolution} ori=${f.orientation}`).toBe(f.offset[0]);
      expect(anchor.offset[1], `offset[1] for s=${f.s} res=${f.resolution} ori=${f.orientation}`).toBe(f.offset[1]);
      expect(anchor.flips[0], `flips[0] for s=${f.s} res=${f.resolution} ori=${f.orientation}`).toBe(f.flips[0]);
      expect(anchor.flips[1], `flips[1] for s=${f.s} res=${f.resolution} ori=${f.orientation}`).toBe(f.flips[1]);
    }
  });
});

describe('anchorToS', () => {
  it('round-trips back to the original s-value', () => {
    for (const f of fixtures.sToAnchor as SToAnchorFixture[]) {
      const anchor: Anchor = {
        q: f.q,
        offset: f.offset as IJ,
        flips: f.flips,
      };
      const s = anchorToS(anchor, f.resolution, f.orientation);
      expect(Number(s), `s for res=${f.resolution} ori=${f.orientation}`).toBe(f.s);
    }
  });
});

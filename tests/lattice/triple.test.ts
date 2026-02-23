import { describe, it, expect } from 'vitest';
import type { Orientation, Triple } from 'a5/lattice';
import { sToAnchor, anchorToTriple, tripleToAnchor, tripleToS, tripleParity, tripleInBounds } from 'a5/lattice';
import fixtures from '../fixtures/lattice/triple.json';

type AnchorToTripleFixture = {
  s: number;
  resolution: number;
  orientation: Orientation;
  x: number;
  y: number;
  z: number;
  parity: number;
};

type TripleInBoundsFixture = {
  x: number;
  y: number;
  z: number;
  maxRow: number;
  expected: boolean;
};

describe('anchorToTriple', () => {
  it('produces correct triple coordinates', () => {
    for (const f of fixtures.anchorToTriple as AnchorToTripleFixture[]) {
      const anchor = sToAnchor(BigInt(f.s), f.resolution, f.orientation);
      const triple = anchorToTriple(anchor);
      expect(triple.x, `x for s=${f.s} res=${f.resolution} ori=${f.orientation}`).toBe(f.x);
      expect(triple.y, `y for s=${f.s} res=${f.resolution} ori=${f.orientation}`).toBe(f.y);
      expect(triple.z, `z for s=${f.s} res=${f.resolution} ori=${f.orientation}`).toBe(f.z);
    }
  });
});

describe('tripleParity', () => {
  it('returns correct parity', () => {
    for (const f of fixtures.anchorToTriple as AnchorToTripleFixture[]) {
      const triple: Triple = {x: f.x, y: f.y, z: f.z};
      expect(tripleParity(triple), `parity for (${f.x},${f.y},${f.z})`).toBe(f.parity);
    }
  });
});

describe('tripleToS', () => {
  it('round-trips back to the original s-value', () => {
    for (const f of fixtures.anchorToTriple as AnchorToTripleFixture[]) {
      const triple: Triple = {x: f.x, y: f.y, z: f.z};
      const s = tripleToS(triple, f.resolution, f.orientation);
      expect(Number(s), `s for (${f.x},${f.y},${f.z}) res=${f.resolution} ori=${f.orientation}`).toBe(f.s);
    }
  });
});

describe('tripleToAnchor', () => {
  it('produces an anchor matching sToAnchor', () => {
    for (const f of fixtures.anchorToTriple as AnchorToTripleFixture[]) {
      const triple: Triple = {x: f.x, y: f.y, z: f.z};
      const expected = sToAnchor(BigInt(f.s), f.resolution, f.orientation);
      const actual = tripleToAnchor(triple, f.resolution, f.orientation);
      expect(actual, `anchor for (${f.x},${f.y},${f.z}) res=${f.resolution} ori=${f.orientation}`).not.toBeNull();
      expect(actual!.offset[0]).toBe(expected.offset[0]);
      expect(actual!.offset[1]).toBe(expected.offset[1]);
      expect(actual!.flips[0]).toBe(expected.flips[0]);
      expect(actual!.flips[1]).toBe(expected.flips[1]);
    }
  });
});

describe('tripleInBounds', () => {
  it('validates quintant bounds correctly', () => {
    for (const f of fixtures.tripleInBounds as TripleInBoundsFixture[]) {
      const triple: Triple = {x: f.x, y: f.y, z: f.z};
      expect(tripleInBounds(triple, f.maxRow), `(${f.x},${f.y},${f.z}) maxRow=${f.maxRow}`).toBe(f.expected);
    }
  });
});

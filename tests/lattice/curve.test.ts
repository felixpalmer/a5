import {describe, it, expect} from 'vitest';
import type {IJ} from 'a5/core/coordinate-systems';
import type {Orientation, Triple} from 'a5/lattice';
import {sToCell, sToTriple, tripleToS, tripleParity, tripleInBounds, tripleFlavor, IJToS} from 'a5/lattice';
import fixtures from '../fixtures/lattice/curve.json';

type SToCellFixture = {
  s: number;
  resolution: number;
  orientation: Orientation;
  x: number;
  y: number;
  z: number;
  parity: number;
  flavor: number;
};

type IJToSFixture = {
  i: number;
  j: number;
  resolution: number;
  orientation: Orientation;
  s: number;
};

type TripleInBoundsFixture = {
  x: number;
  y: number;
  z: number;
  maxRow: number;
  expected: boolean;
};

describe('sToCell', () => {
  it('produces correct triple coordinates and pentagon flavor', () => {
    for (const f of fixtures.sToCell as SToCellFixture[]) {
      const {triple, flavor} = sToCell(BigInt(f.s), f.resolution, f.orientation);
      expect(triple.x, `x for s=${f.s} res=${f.resolution} ori=${f.orientation}`).toBe(f.x);
      expect(triple.y, `y for s=${f.s} res=${f.resolution} ori=${f.orientation}`).toBe(f.y);
      expect(triple.z, `z for s=${f.s} res=${f.resolution} ori=${f.orientation}`).toBe(f.z);
      expect(flavor, `flavor for s=${f.s} res=${f.resolution} ori=${f.orientation}`).toBe(f.flavor);
    }
  });
});

describe('sToTriple', () => {
  it('matches the triple part of sToCell', () => {
    for (const f of fixtures.sToCell as SToCellFixture[]) {
      const triple = sToTriple(BigInt(f.s), f.resolution, f.orientation);
      expect(triple).toEqual({x: f.x, y: f.y, z: f.z});
    }
  });
});

describe('tripleParity', () => {
  it('returns correct parity', () => {
    for (const f of fixtures.sToCell as SToCellFixture[]) {
      const triple: Triple = {x: f.x, y: f.y, z: f.z};
      expect(tripleParity(triple), `parity for (${f.x},${f.y},${f.z})`).toBe(f.parity);
    }
  });
});

describe('tripleToS', () => {
  it('round-trips back to the original s-value', () => {
    for (const f of fixtures.sToCell as SToCellFixture[]) {
      const triple: Triple = {x: f.x, y: f.y, z: f.z};
      const s = tripleToS(triple, f.resolution, f.orientation);
      expect(Number(s), `s for (${f.x},${f.y},${f.z}) res=${f.resolution} ori=${f.orientation}`).toBe(f.s);
    }
  });
});

describe('IJToS', () => {
  it('locates the containing cell of a fractional IJ point', () => {
    for (const f of fixtures.IJToS as IJToSFixture[]) {
      const s = IJToS([f.i, f.j] as IJ, f.resolution, f.orientation);
      expect(Number(s), `s for (${f.i},${f.j}) res=${f.resolution} ori=${f.orientation}`).toBe(f.s);
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

describe('tripleFlavor', () => {
  it('matches the descent flavor for every cell (closed form)', () => {
    // The pentagon flavor depends only on (parity, y mod 2); pin the closed
    // form against the descent over all cells at res 6, two orientations.
    for (const orientation of ['uv', 'wu'] as const) {
      for (let s = 0n; s < 1n << 12n; s++) {
        const cell = sToCell(s, 6, orientation);
        expect(tripleFlavor(cell.triple)).toBe(cell.flavor);
      }
    }
  });
});

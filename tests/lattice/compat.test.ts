import {describe, it, expect} from 'vitest';
import type {IJ} from 'a5/core/coordinate-systems';
import type {Orientation, Triple} from 'a5/lattice';
import {compatSToCell, compatSToTriple, compatTripleToS, compatIJToS} from 'a5/lattice';
import fixtures from '../fixtures/lattice/compat.json';

type CompatFixture = {
  s: number;
  resolution: number;
  orientation: Orientation;
  x: number;
  y: number;
  z: number;
  flavor: number;
};

type IJToSFixture = {
  i: number;
  j: number;
  resolution: number;
  orientation: Orientation;
  s: number;
};

// The compat curve reproduces the ORIGINAL (pre-L-system) A5 curve bit-for-bit
// (established exhaustively against the original engine when it was ported);
// these fixtures pin it against regressions.
describe('compatSToCell', () => {
  it('produces correct triple coordinates and pentagon flavor', () => {
    for (const f of fixtures.sToCell as CompatFixture[]) {
      const {triple, flavor} = compatSToCell(BigInt(f.s), f.resolution, f.orientation);
      expect(triple.x, `x for s=${f.s} res=${f.resolution} ori=${f.orientation}`).toBe(f.x);
      expect(triple.y, `y for s=${f.s} res=${f.resolution} ori=${f.orientation}`).toBe(f.y);
      expect(triple.z, `z for s=${f.s} res=${f.resolution} ori=${f.orientation}`).toBe(f.z);
      expect(flavor, `flavor for s=${f.s} res=${f.resolution} ori=${f.orientation}`).toBe(f.flavor);
    }
  });
});

describe('compatSToTriple', () => {
  it('matches the triple part of compatSToCell', () => {
    for (const f of fixtures.sToCell as CompatFixture[]) {
      const triple = compatSToTriple(BigInt(f.s), f.resolution, f.orientation);
      expect(triple).toEqual({x: f.x, y: f.y, z: f.z});
    }
  });
});

describe('compatTripleToS', () => {
  it('round-trips back to the original s-value', () => {
    for (const f of fixtures.sToCell as CompatFixture[]) {
      const triple: Triple = {x: f.x, y: f.y, z: f.z};
      const s = compatTripleToS(triple, f.resolution, f.orientation);
      expect(Number(s), `s for (${f.x},${f.y},${f.z}) res=${f.resolution} ori=${f.orientation}`).toBe(f.s);
    }
  });
});

describe('compatIJToS', () => {
  it('locates the containing cell of a fractional IJ point', () => {
    for (const f of fixtures.IJToS as IJToSFixture[]) {
      const s = compatIJToS([f.i, f.j] as IJ, f.resolution, f.orientation);
      expect(Number(s), `s for (${f.i},${f.j}) res=${f.resolution} ori=${f.orientation}`).toBe(f.s);
    }
  });
});

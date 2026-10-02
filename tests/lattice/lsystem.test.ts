import {describe, it, expect} from 'vitest';
import type {IJ} from 'a5/core/coordinate-systems';
import type {Orientation, Triple} from 'a5/lattice';
import {sToCell, sToTriple, tripleToSLattice} from 'a5/lattice/lsystem';
import {IJToS} from 'a5/lattice/curve';
import fixtures from '../fixtures/lattice/lsystem.json';

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

// The non-self-intersecting L-system curve — the planned FUTURE canonical
// curve (a breaking change of all cell IDs). These fixtures pin its behavior
// ahead of the canonical swap: when the swap happens, curve.json is
// regenerated and must equal these values.
describe('lsystem sToCell', () => {
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

describe('lsystem sToTriple', () => {
  it('matches the triple part of sToCell', () => {
    for (const f of fixtures.sToCell as SToCellFixture[]) {
      const triple = sToTriple(BigInt(f.s), f.resolution, f.orientation);
      expect(triple).toEqual({x: f.x, y: f.y, z: f.z});
    }
  });
});

describe('lsystem tripleToSLattice', () => {
  it('round-trips back to the original s-value', () => {
    for (const f of fixtures.sToCell as SToCellFixture[]) {
      const triple: Triple = {x: f.x, y: f.y, z: f.z};
      const s = tripleToSLattice(triple, f.resolution, f.orientation);
      expect(Number(s), `s for (${f.x},${f.y},${f.z}) res=${f.resolution} ori=${f.orientation}`).toBe(f.s);
    }
  });
});

describe('lsystem IJToS', () => {
  it('locates the containing cell of a fractional IJ point', () => {
    for (const f of fixtures.IJToS as IJToSFixture[]) {
      const s = IJToS([f.i, f.j] as IJ, f.resolution, f.orientation);
      expect(Number(s), `s for (${f.i},${f.j}) res=${f.resolution} ori=${f.orientation}`).toBe(f.s);
    }
  });
});

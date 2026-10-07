import {describe, it, expect} from 'vitest';
import type {IJ} from 'a5/core/coordinate-systems';
import type {Orientation, Triple} from 'a5/lattice';
import {curveChild, curveRoot, sToCell, sToTriple, tripleToSLattice} from 'a5/lattice/lsystem';
import {roundToTriple} from 'a5/lattice/curve';
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

type PointToSFixture = {
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

describe('lsystem pointToS (roundToTriple + tripleToSLattice)', () => {
  it('locates the containing cell of a fractional IJ point', () => {
    for (const f of fixtures.pointToS as PointToSFixture[]) {
      const s = tripleToSLattice(roundToTriple([f.i, f.j] as IJ, f.resolution), f.resolution, f.orientation);
      expect(Number(s), `s for (${f.i},${f.j}) res=${f.resolution} ori=${f.orientation}`).toBe(f.s);
    }
  });
});

describe('curveChild', () => {
  const ORIENTATIONS: Orientation[] = ['uv', 'vu', 'uw', 'wu', 'vw', 'wv'];

  it('should step down the hierarchy in agreement with sToCell', () => {
    for (const orientation of ORIENTATIONS) {
      // Every cell through resolution 3, then one deep path to resolution 30
      const stack: [ReturnType<typeof curveRoot>, bigint, number][] = [[curveRoot(orientation), 0n, 0]];
      while (stack.length > 0) {
        const [node, s, resolution] = stack.pop()!;
        if (resolution === 3) continue;
        for (let digit = 0; digit < 4; digit++) {
          const child = curveChild(node, digit, resolution + 1, orientation);
          const childS = s * 4n + BigInt(digit);
          expect(child.cell).toEqual(sToCell(childS, resolution + 1, orientation));
          stack.push([child.node, childS, resolution + 1]);
        }
      }
      let node = curveRoot(orientation);
      let s = 0n;
      for (let resolution = 1; resolution <= 30; resolution++) {
        const digit = (resolution * 7 + orientation.charCodeAt(0)) % 4;
        const child = curveChild(node, digit, resolution, orientation);
        s = s * 4n + BigInt(digit);
        expect(child.cell).toEqual(sToCell(s, resolution, orientation));
        node = child.node;
      }
    }
  });
});

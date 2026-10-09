import {describe, it, expect} from 'vitest';
import type {IJ} from 'a5/core/coordinate-systems';
import type {Orientation, Triple} from 'a5/lattice';
import {curveChild, sToCell, sToTriple, tripleToCurveNode, tripleToSLattice} from 'a5/lattice/lsystem';
import type {CurveNode} from 'a5/lattice/lsystem';
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

describe('curveChild / tripleToCurveNode', () => {
  const ORIENTATIONS: Orientation[] = ['uv', 'vu', 'uw', 'wu', 'vw', 'wv'];
  const root = (orientation: Orientation) => tripleToCurveNode({x: 0, y: 0, z: 0}, 0, orientation).node;

  // Step to the child with `digit`, checking it against sToCell, and the
  // descent state against tripleToCurveNode's from the child's triple
  const step = (node: CurveNode, s: bigint, digit: number, resolution: number, orientation: Orientation) => {
    const triple = {x: 0, y: 0, z: 0};
    const below: CurveNode = {motif: 0, flip: 0, posA: 0, posB: 0};
    const flavor = curveChild(node, digit, resolution, orientation, triple, below);
    const childS = s * 4n + BigInt(digit);
    expect({triple, flavor}).toEqual(sToCell(childS, resolution, orientation));
    expect(tripleToCurveNode(triple, resolution, orientation)).toEqual({s: childS, flavor, node: below});
    return {node: below, s: childS};
  };

  it('should step down the hierarchy in agreement with sToCell and tripleToCurveNode', () => {
    for (const orientation of ORIENTATIONS) {
      // Every cell through level 3, then one deep path to level 29 (A5 resolution 30)
      const stack: [CurveNode, bigint, number][] = [[root(orientation), 0n, 0]];
      while (stack.length > 0) {
        const [node, s, resolution] = stack.pop()!;
        if (resolution === 3) continue;
        for (let digit = 0; digit < 4; digit++) {
          const child = step(node, s, digit, resolution + 1, orientation);
          stack.push([child.node, child.s, resolution + 1]);
        }
      }
      let child = {node: root(orientation), s: 0n};
      for (let resolution = 1; resolution <= 29; resolution++) {
        const digit = (resolution * 7 + orientation.charCodeAt(0)) % 4;
        child = step(child.node, child.s, digit, resolution, orientation);
      }
    }
  });
});

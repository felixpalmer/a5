import {describe, it, expect} from 'vitest';
import {tripleChildren, tripleParent} from 'a5/traversal/triple-cells';
import fixtures from '../fixtures/traversal/triple-hierarchy.json';

type Fixture = {hilbertRes: number; triple: number[]; children: number[][]};

const byCoords = (a: number[], b: number[]) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

describe('triple-space hierarchy', () => {
  it('tripleChildren gives the curve children of every cell', () => {
    for (const f of fixtures.cases as Fixture[]) {
      const [x, y, z] = f.triple;
      const out: number[] = [];
      tripleChildren(0, 0, x, y, z, (1 << f.hilbertRes) - 1, out);
      const children = [0, 5, 10, 15].map(c => out.slice(c + 2, c + 5)).sort(byCoords);
      expect(children, `${f.triple} @ ${f.hilbertRes}`).toEqual(f.children);
    }
  });

  it('tripleParent gives every child back its parent', () => {
    for (const f of fixtures.cases as Fixture[]) {
      for (const [x, y, z] of f.children) {
        const out: number[] = [];
        tripleParent(0, 0, x, y, z, (1 << f.hilbertRes) - 1, out);
        expect(out.slice(2), `${[x, y, z]} @ ${f.hilbertRes + 1}`).toEqual(f.triple);
      }
    }
  });
});

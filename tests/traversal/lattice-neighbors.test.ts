import {describe, it, expect} from 'vitest';
import {getLatticeNeighbors} from 'a5/traversal/lattice-neighbors';
import {hexToU64, u64ToHex} from 'a5/core/hex';
import fixtures from '../fixtures/traversal/lattice-neighbors.json';

type Fixture = {
  cell: string;
  resolution: number;
  neighbors: string[];
};

describe('getLatticeNeighbors', () => {
  for (const f of fixtures.cases as Fixture[]) {
    it(`${f.cell} (res ${f.resolution})`, () => {
      const neighbors = getLatticeNeighbors(hexToU64(f.cell)).map(u64ToHex).sort();
      expect(neighbors).toEqual(f.neighbors);
    });
  }
});

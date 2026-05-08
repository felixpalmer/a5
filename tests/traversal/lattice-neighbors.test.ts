import { describe, it, expect } from 'vitest';
import { getLatticeNeighbors } from 'a5/traversal/lattice-neighbors';
import { hexToU64, u64ToHex } from 'a5/core/hex';
import fixtures from '../fixtures/traversal/lattice-neighbors.json';

type Fixture = {
  cell: string;
  resolution: number;
  edgeOnlyNeighbors: string[];
  supersetNeighbors: string[];
};

describe('getLatticeNeighbors', () => {
  for (const f of fixtures.cases as Fixture[]) {
    it(`${f.cell} (res ${f.resolution})`, () => {
      const cell = hexToU64(f.cell);

      const edge = getLatticeNeighbors(cell, true).map(u64ToHex).sort();
      expect(edge).toEqual(f.edgeOnlyNeighbors);

      const superset = getLatticeNeighbors(cell, false).map(u64ToHex).sort();
      expect(superset).toEqual(f.supersetNeighbors);
    });
  }
});

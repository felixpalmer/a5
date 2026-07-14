import {describe, it, expect} from 'vitest';
import type {Orientation} from 'a5/lattice';
import {getCellNeighbors} from 'a5/traversal/quintant-neighbors';
import {NEIGHBOR_DELTAS} from 'a5/traversal/neighbors';
import fixtures from '../fixtures/traversal/quintant-neighbors.json';

type Fixture = {
  input: {s: number; resolution: number; orientation: string};
  output: {neighbors: number[]};
};

describe('getCellNeighbors', () => {
  it('should find correct neighbors for all orientations', () => {
    for (const f of fixtures as Fixture[]) {
      const {s, resolution, orientation} = f.input;
      const result = getCellNeighbors(BigInt(s), resolution, orientation as Orientation).map(Number);
      expect(result).toEqual(f.output.neighbors);
    }
  });
});

describe('NEIGHBOR_DELTAS', () => {
  it('has all = edge ++ vertex for every flavor', () => {
    for (const {edge, vertex, all} of NEIGHBOR_DELTAS) {
      expect(all).toEqual([...edge, ...vertex]);
    }
  });
});

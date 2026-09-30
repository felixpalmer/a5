import {describe, it, expect} from 'vitest';
import {hexToU64, u64ToHex, getResolution} from 'a5';
import {getGlobalCellNeighbors} from 'a5/traversal/global-neighbors';
import fixtures from '../fixtures/traversal/global-neighbors.json';

type Fixture = {
  input: {cellId: string};
  output: {neighbors: string[]; edgeNeighbors: string[]};
};

describe('getGlobalCellNeighbors', () => {
  it('should find all vertex-sharing neighbors', () => {
    for (const f of fixtures as Fixture[]) {
      const cellId = hexToU64(f.input.cellId);
      const result = getGlobalCellNeighbors(cellId).map(n => u64ToHex(n));
      expect(result).toEqual(f.output.neighbors);
    }
  });

  it('should find edge-only neighbors', () => {
    for (const f of fixtures as Fixture[]) {
      const cellId = hexToU64(f.input.cellId);
      const result = getGlobalCellNeighbors(cellId, {edgeOnly: true}).map(n => u64ToHex(n));
      expect(result).toEqual(f.output.edgeNeighbors);
    }
  });

  it('should return 5 edge neighbors at every resolution', () => {
    // Every cell is a pentagon: the dodecahedron faces at resolution 0, the
    // pentagonal hexecontahedron at resolution 1, the lattice tiling beyond
    for (const f of fixtures as Fixture[]) {
      expect(f.output.edgeNeighbors.length).toBe(5);
    }
  });

  it('should find symmetric neighbors at resolution 1', () => {
    // Resolution 1 neighbors come from a hand-derived rule over face
    // adjacency (not the lattice), so check it is self-consistent: every
    // neighbor relation is mutual, with 5 edge and 2 vertex-only neighbors
    for (const f of fixtures as Fixture[]) {
      const cellId = hexToU64(f.input.cellId);
      if (getResolution(cellId) !== 1) continue;
      expect(f.output.neighbors.length).toBe(7);
      for (const hex of f.output.neighbors) {
        expect(getGlobalCellNeighbors(hexToU64(hex)).map(n => u64ToHex(n))).toContain(f.input.cellId);
      }
      for (const hex of f.output.edgeNeighbors) {
        expect(getGlobalCellNeighbors(hexToU64(hex), {edgeOnly: true}).map(n => u64ToHex(n))).toContain(f.input.cellId);
      }
    }
  });
});

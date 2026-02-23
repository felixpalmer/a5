import { describe, it, expect } from 'vitest';
import { hexToU64, u64ToHex } from 'a5';
import { getGlobalCellNeighbors } from 'a5/traversal/global-neighbors';
import fixtures from '../fixtures/traversal/global-neighbors.json';

type Fixture = {
  input: { cellId: string };
  output: { neighbors: string[]; edgeNeighbors: string[] };
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
      const result = getGlobalCellNeighbors(cellId, { edgeOnly: true }).map(n => u64ToHex(n));
      expect(result).toEqual(f.output.edgeNeighbors);
    }
  });

  it('should always return exactly 5 edge neighbors', () => {
    for (const f of fixtures as Fixture[]) {
      expect(f.output.edgeNeighbors.length).toBe(5);
    }
  });
});

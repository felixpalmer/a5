import { describe, it, expect } from 'vitest';
import { hexToU64, u64ToHex, getResolution } from 'a5';
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

  it('should return correct edge neighbor count per resolution', () => {
    for (const f of fixtures as Fixture[]) {
      const resolution = getResolution(hexToU64(f.input.cellId));
      // Res 0: pentagonal face → 5 edge neighbors
      // Res 1: triangular quintant → 3 edge neighbors
      // Res 2+: pentagonal cell → 5 edge neighbors
      const expectedEdgeCount = resolution === 1 ? 3 : 5;
      expect(f.output.edgeNeighbors.length).toBe(expectedEdgeCount);
    }
  });
});

import {describe, it, expect} from 'vitest';
import {tripleSpaceFloodFill} from 'a5/traversal/lattice-flood-fill';
import {hexToU64, u64ToHex} from 'a5/core/hex';
import fixtures from '../fixtures/traversal/lattice-flood-fill.json';

type Fixture = {
  name: string;
  resolution: number;
  seedCells: string[];
  firewallCells: string[];
  maxLayers?: number;
  interiorCells: string[];
  frontierCells: string[];
};

describe('tripleSpaceFloodFill', () => {
  for (const f of fixtures.cases as Fixture[]) {
    it(`${f.name}`, () => {
      const seeds = f.seedCells.map(hexToU64);
      const firewall = new Set(f.firewallCells.map(hexToU64));

      const result = tripleSpaceFloodFill(firewall, seeds, f.resolution, f.maxLayers);
      const interior = result.interiorCells.map(u64ToHex).sort();
      const frontier = result.frontierCellIds.map(u64ToHex).sort();

      expect(interior).toEqual(f.interiorCells);
      expect(frontier).toEqual(f.frontierCells);
    });
  }
});

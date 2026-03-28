import { describe, it, expect } from 'vitest';
import { gridDisk, gridDiskVertex, uncompact, getResolution, hexToU64, u64ToHex } from 'a5';
import fixtures from '../fixtures/traversal/grid-disk.json';

type Fixture = {
  cellId: string;
  k: number;
  cells: string[];
  extraVertexCells: string[];
};

const cases = fixtures as Fixture[];

/** Sort hex cell IDs by numeric value. */
function sortHex(cells: string[]): string[] {
  return cells.sort((a, b) => a.padStart(20, '0').localeCompare(b.padStart(20, '0')));
}

describe('gridDisk', () => {
  it('should return correct cells for all k values', () => {
    for (const f of cases) {
      const cellId = hexToU64(f.cellId);
      const targetRes = getResolution(cellId);
      const result = sortHex(Array.from(uncompact(gridDisk(cellId, f.k), targetRes))
        .map(n => u64ToHex(n)));
      expect(result).toEqual(sortHex([...f.cells]));
    }
  });

  it('should return a BigUint64Array', () => {
    const cellId = hexToU64(cases[0].cellId);
    expect(gridDisk(cellId, 1)).toBeInstanceOf(BigUint64Array);
  });

  it('should return only center cell for k=0', () => {
    const cellId = hexToU64(cases[0].cellId);
    const result = Array.from(gridDisk(cellId, 0)).map(n => u64ToHex(n));
    expect(result).toEqual([cases[0].cellId]);
  });
});

describe('gridDiskVertex', () => {
  it('should return correct cells for all k values', () => {
    for (const f of cases) {
      const cellId = hexToU64(f.cellId);
      const targetRes = getResolution(cellId);
      const expected = sortHex([...f.cells, ...f.extraVertexCells]);
      const result = sortHex(Array.from(uncompact(gridDiskVertex(cellId, f.k), targetRes))
        .map(n => u64ToHex(n)));
      expect(result).toEqual(expected);
    }
  });

  it('should return a BigUint64Array', () => {
    const cellId = hexToU64(cases[0].cellId);
    expect(gridDiskVertex(cellId, 1)).toBeInstanceOf(BigUint64Array);
  });

  it('should return only center cell for k=0', () => {
    const cellId = hexToU64(cases[0].cellId);
    const result = Array.from(gridDiskVertex(cellId, 0)).map(n => u64ToHex(n));
    expect(result).toEqual([cases[0].cellId]);
  });
});

import {describe, it, expect} from 'vitest';
import {gridDisk, gridDiskVertex, uncompact, isCompactionMarker, hexToU64, u64ToHex} from 'a5';
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
      const result = sortHex(Array.from(uncompact(gridDisk(cellId, f.k))).map(n => u64ToHex(n)));
      expect(result).toEqual(sortHex([...f.cells]));
    }
  });

  it('should return a BigUint64Array', () => {
    const cellId = hexToU64(cases[0].cellId);
    expect(gridDisk(cellId, 1)).toBeInstanceOf(BigUint64Array);
  });

  it('should return only center cell for k=0', () => {
    const cellId = hexToU64(cases[0].cellId);
    const result = gridDisk(cellId, 0);
    // The cell itself, then the compaction marker recording its resolution
    expect(result.length).toBe(2);
    expect(u64ToHex(result[0])).toBe(cases[0].cellId);
    expect(isCompactionMarker(result[1])).toBe(true);
    expect(Array.from(uncompact(result)).map(n => u64ToHex(n))).toEqual([cases[0].cellId]);
  });
});

describe('gridDiskVertex', () => {
  it('should return correct cells for all k values', () => {
    for (const f of cases) {
      const cellId = hexToU64(f.cellId);
      const expected = sortHex([...f.cells, ...f.extraVertexCells]);
      const result = sortHex(Array.from(uncompact(gridDiskVertex(cellId, f.k))).map(n => u64ToHex(n)));
      expect(result).toEqual(expected);
    }
  });

  it('should return a BigUint64Array', () => {
    const cellId = hexToU64(cases[0].cellId);
    expect(gridDiskVertex(cellId, 1)).toBeInstanceOf(BigUint64Array);
  });

  it('should return only center cell for k=0', () => {
    const cellId = hexToU64(cases[0].cellId);
    const result = gridDiskVertex(cellId, 0);
    // The cell itself, then the compaction marker recording its resolution
    expect(result.length).toBe(2);
    expect(u64ToHex(result[0])).toBe(cases[0].cellId);
    expect(isCompactionMarker(result[1])).toBe(true);
    expect(Array.from(uncompact(result)).map(n => u64ToHex(n))).toEqual([cases[0].cellId]);
  });
});

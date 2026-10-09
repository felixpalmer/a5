import {describe, it, expect} from 'vitest';
import {
  cellToSubcell,
  cellToSupercell,
  coveringResolution,
  count,
  getResolution,
  hexToU64,
  u64ToHex,
  uncompact
} from 'a5';
import fixtures from '../fixtures/regions/subcell.json';

type SubcellFixture = {
  cell: string;
  resolution: number;
  count: number;
  cells: string[];
};

type SupercellFixture = {
  cell: string;
  resolution: number;
  supercell: string;
};

describe('cellToSubcell', () => {
  const cases = fixtures.subcell as SubcellFixture[];

  for (const f of cases) {
    it(`should give the subcells of ${f.cell} at resolution ${f.resolution}`, () => {
      const result = cellToSubcell(hexToU64(f.cell), f.resolution);
      expect(Array.from(result).map(c => u64ToHex(c))).toEqual(f.cells);
      expect(count(result)).toBe(BigInt(f.count));
    });
  }

  it('should map every subcell back to its cell', () => {
    for (const f of cases) {
      const cell = hexToU64(f.cell);
      const cellResolution = getResolution(cell);
      for (const subcell of uncompact(cellToSubcell(cell, f.resolution))) {
        expect(cellToSupercell(subcell, cellResolution)).toBe(cell);
      }
    }
  });

  it('should return the cell itself at its own resolution', () => {
    const cell = hexToU64(cases[5].cell);
    const result = cellToSubcell(cell, getResolution(cell));
    expect(Array.from(uncompact(result))).toEqual([cell]);
    expect(coveringResolution(result)).toBe(getResolution(cell));
  });

  it('should throw for a coarser resolution', () => {
    const cell = hexToU64(cases[5].cell);
    expect(() => cellToSubcell(cell, getResolution(cell) - 1)).toThrow();
  });
});

describe('cellToSupercell', () => {
  const cases = fixtures.supercell as SupercellFixture[];

  it('should give the supercell', () => {
    for (const f of cases) {
      expect(u64ToHex(cellToSupercell(hexToU64(f.cell), f.resolution))).toBe(f.supercell);
    }
  });

  it('should throw for a finer resolution', () => {
    const cell = hexToU64(cases[0].cell);
    expect(() => cellToSupercell(cell, getResolution(cell) + 1)).toThrow();
  });
});

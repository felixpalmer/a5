import { describe, it, expect } from 'vitest';
import { sphericalCap, uncompact, getResolution, hexToU64, u64ToHex } from 'a5';
import { metersToH, estimateCellRadius, pickCoarseResolution } from 'a5/traversal/cap';
import fixtures from '../fixtures/traversal/cap.json';

type SphericalCapFixture = {
  cellId: string;
  radius: number;
  cells: string[];
};

type SphericalCapCompactFixture = {
  cellId: string;
  radius: number;
  compactedCells: string[];
};

describe('sphericalCap', () => {
  const flatCases = fixtures.sphericalCap as SphericalCapFixture[];
  const compactCases = fixtures.sphericalCapCompact as SphericalCapCompactFixture[];

  it('should return a BigUint64Array', () => {
    const cellId = hexToU64(flatCases[0].cellId);
    expect(sphericalCap(cellId, flatCases[0].radius)).toBeInstanceOf(BigUint64Array);
  });

  it('should return correct cells when uncompacted', () => {
    for (const f of flatCases) {
      const cellId = hexToU64(f.cellId);
      const targetRes = getResolution(cellId);
      const result = Array.from(uncompact(sphericalCap(cellId, f.radius), targetRes))
        .map(n => u64ToHex(n));
      expect(result).toEqual(f.cells);
    }
  });

  it('should return correct compacted cells', () => {
    for (const f of compactCases) {
      const cellId = hexToU64(f.cellId);
      const result = Array.from(sphericalCap(cellId, f.radius))
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
        .map(n => u64ToHex(n));
      expect(result).toEqual(f.compactedCells);
    }
  });
});

describe('metersToH', () => {
  it('should convert meters to haversine threshold', () => {
    for (const f of fixtures.helpers.metersToH) {
      expect(metersToH(f.meters)).toBe(f.expectedH);
    }
  });
});

describe('estimateCellRadius', () => {
  it('should return correct radius for each resolution', () => {
    for (const f of fixtures.helpers.estimateCellRadius) {
      expect(estimateCellRadius(f.resolution)).toBe(f.expectedMeters);
    }
  });

  it('should decrease with increasing resolution', () => {
    const cases = fixtures.helpers.estimateCellRadius;
    for (let i = 1; i < cases.length; i++) {
      expect(cases[i].expectedMeters).toBeLessThan(cases[i - 1].expectedMeters);
    }
  });
});

describe('pickCoarseResolution', () => {
  it('should return correct coarse resolution', () => {
    for (const f of fixtures.helpers.pickCoarseResolution) {
      expect(pickCoarseResolution(f.radius, f.targetRes)).toBe(f.expectedCoarseRes);
    }
  });

  it('should never exceed targetRes', () => {
    for (const f of fixtures.helpers.pickCoarseResolution) {
      expect(pickCoarseResolution(f.radius, f.targetRes)).toBeLessThanOrEqual(f.targetRes);
    }
  });
});

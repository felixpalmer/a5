import { describe, expect, test } from 'vitest';
import { getNumCells, cellArea } from 'a5/core/cell-info';
import cellInfoFixtures from './fixtures/cell-info.json';

describe('getNumCells', () => {
  test('returns correct number of cells for all resolutions', () => {
    cellInfoFixtures.numCells.forEach(fixture => {
      expect(getNumCells(fixture.resolution)).toBe(fixture.count);
      expect(getNumCells(BigInt(fixture.resolution)).toString()).toBe(fixture.countBigInt);
    });
  });
});

describe('cellArea', () => {
  test('returns correct area for all resolutions', () => {
    cellInfoFixtures.cellArea.forEach(fixture => {
      expect(cellArea(fixture.resolution)).toBe(fixture.areaM2);
    });
  });
}); 
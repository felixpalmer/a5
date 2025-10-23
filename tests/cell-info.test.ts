import { describe, expect, test } from 'vitest';
import { getNumCells, getNumChildren, cellArea } from 'a5/core/cell-info';
import cellInfoFixtures from './fixtures/cell-info.json';

describe('getNumCells', () => {
  test('returns correct number of cells for all resolutions', () => {
    cellInfoFixtures.numCells.forEach(fixture => {
      expect(getNumCells(fixture.resolution)).toBe(fixture.count);
      expect(getNumCells(BigInt(fixture.resolution)).toString()).toBe(fixture.countBigInt);
    });
  });
});

describe('getNumChildren', () => {
  test('returns correct number of children for parent-child resolution pairs', () => {
    cellInfoFixtures.numChildren.forEach(fixture => {
      expect(getNumChildren(fixture.parentResolution, fixture.childResolution)).toBe(fixture.numChildren);
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
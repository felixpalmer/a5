import { describe, it, expect, test } from 'vitest';
import { getNumCells, cellArea } from 'a5/core/cell-info';

describe('getNumCells', () => {
  test('returns correct number of cells for known resolutions', () => {
    expect(getNumCells(0)).toBe(12);
    expect(getNumCells(1)).toBe(60);
    expect(getNumCells(2)).toBe(240);
    expect(getNumCells(3)).toBe(960);
  });

  test('returns correct number of cells for higher resolutions', () => {
    expect(getNumCells(4)).toBe(3840); // 960 * 4
    expect(getNumCells(5)).toBe(15360); // 960 * 4^2
    expect(getNumCells(6)).toBe(61440); // 960 * 4^3
  });
});

describe('cellArea', () => {
  test('returns correct area for resolution 0', () => {
    const area = cellArea(0);
    const expectedArea = (4 * Math.PI * 6371.0072 * 6371.0072) / 12;
    expect(area).toBeCloseTo(expectedArea, 0);
  });

  test('returns correct area for resolution 1', () => {
    const area = cellArea(1);
    const expectedArea = (4 * Math.PI * 6371.0072 * 6371.0072) / 60;
    expect(area).toBeCloseTo(expectedArea, 0);
  });

  test('returns correct area for resolution 2', () => {
    const area = cellArea(2);
    const expectedArea = (4 * Math.PI * 6371.0072 * 6371.0072) / 240;
    expect(area).toBeCloseTo(expectedArea, 0);
  });

  test('returns correct area for resolution 3', () => {
    const area = cellArea(3);
    const expectedArea = (4 * Math.PI * 6371.0072 * 6371.0072) / 960;
    expect(area).toBeCloseTo(expectedArea, 0);
  });

  test('area decreases by factor of 4 for each resolution increase', () => {
    const area0 = cellArea(0);
    const area1 = cellArea(1);
    const area2 = cellArea(2);
    const area3 = cellArea(3);

    expect(area0 / area1).toBeCloseTo(5, 0); // 12 to 60 = factor of 5
    expect(area1 / area2).toBeCloseTo(4, 0); // 60 to 240 = factor of 4
    expect(area2 / area3).toBeCloseTo(4, 0); // 240 to 960 = factor of 4
  });
}); 
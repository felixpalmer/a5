import {describe, it, expect} from 'vitest';
import {hexToU64, u64ToHex, polygonToCells, uncompact, getResolution} from 'a5';
import type {LonLat} from 'a5/core/coordinate-systems';
import fixtures from '../fixtures/regions/polygon.json';

type PolygonFixture = {
  name: string;
  ring: [number, number][];
  resolution: number;
  cells: string[];
};

type CountryFixture = {
  name: string;
  ring: [number, number][];
  resolution: number;
  cellCount: number;
};

describe('polygonToCells', () => {
  const cases = fixtures.polygon as PolygonFixture[];

  for (const f of cases) {
    it(`should fill correct cells for ${f.name}`, () => {
      const result = polygonToCells(f.ring as LonLat[], f.resolution);
      const expanded = uncompact(result, f.resolution);
      const sorted = [...expanded].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      const resultHex = sorted.map(c => u64ToHex(c));
      expect(resultHex).toEqual(f.cells);
    });
  }

  it('should return empty for less than 3 vertices', () => {
    expect(polygonToCells([] as LonLat[], 5).length).toBe(0);
    expect(
      polygonToCells(
        [
          [0, 0],
          [1, 1]
        ] as LonLat[],
        5
      ).length
    ).toBe(0);
  });

  const countryCases = (fixtures as any).country as CountryFixture[];
  if (countryCases && countryCases.length > 0) {
    for (const f of countryCases) {
      it(`should match brute-force count for ${f.name}`, () => {
        const result = polygonToCells(f.ring as LonLat[], f.resolution);
        const expanded = uncompact(result, f.resolution);
        const unique = new Set(expanded);
        expect(unique.size).toBe(f.cellCount);
      });
    }
  }
});

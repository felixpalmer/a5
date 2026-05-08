import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { hexToU64, u64ToHex, polygonToCells, uncompact, getResolution } from 'a5';
import type { LonLat } from 'a5/core/coordinate-systems';
import fixtures from '../fixtures/regions/polygon.json';

function loadCountryRing(name: string): [number, number][] | null {
  const geojsonPath = join(__dirname, '../../website/static/data/ne_50m_countries.geojson');
  try {
    const data = JSON.parse(readFileSync(geojsonPath, 'utf-8'));
    const feature = data.features.find((f: any) => f.properties.admin === name);
    if (!feature) return null;
    const g = feature.geometry;
    let coords: [number, number][];
    if (g.type === 'Polygon') {
      coords = g.coordinates[0];
    } else if (g.type === 'MultiPolygon') {
      let best = g.coordinates[0][0];
      for (const part of g.coordinates) {
        if (part[0].length > best.length) best = part[0];
      }
      coords = best;
    } else return null;
    return (coords[coords.length - 1][0] === coords[0][0] && coords[coords.length - 1][1] === coords[0][1])
      ? coords.slice(0, -1) : coords;
  } catch { return null; }
}

type PolygonFixture = {
  name: string;
  ring: [number, number][];
  resolution: number;
  cells: string[];
};

type CountryFixture = {
  name: string;
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
    expect(polygonToCells([[0, 0], [1, 1]] as LonLat[], 5).length).toBe(0);
  });

  const countryCases = (fixtures as any).country as CountryFixture[];
  if (countryCases && countryCases.length > 0) {
    for (const f of countryCases) {
      it(`should match brute-force count for ${f.name}`, () => {
        const ring = loadCountryRing(f.name);
        expect(ring).not.toBeNull();
        const result = polygonToCells(ring! as LonLat[], f.resolution);
        const expanded = uncompact(result, f.resolution);
        const unique = new Set(expanded);
        expect(unique.size).toBe(f.cellCount);
      });
    }
  }
});

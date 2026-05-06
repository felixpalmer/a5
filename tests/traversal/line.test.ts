import { describe, it, expect } from 'vitest';
import { hexToU64, u64ToHex, lineSegmentToCells, lineStringToCells } from 'a5';
import type { LonLat } from 'a5/core/coordinate-systems';
import fixtures from '../fixtures/traversal/line.json';

type LineSegmentFixture = {
  name: string;
  start: [number, number];
  end: [number, number];
  resolution: number;
  cells: string[];
};

describe('lineSegmentToCells', () => {
  const cases = fixtures.lineSegment as LineSegmentFixture[];

  for (const f of cases) {
    it(`should trace correct cells for ${f.name}`, () => {
      const result = lineSegmentToCells(f.start as LonLat, f.end as LonLat, f.resolution);
      const sorted = [...result].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      const resultHex = sorted.map(c => u64ToHex(c));
      expect(resultHex).toEqual(f.cells);
    });
  }
});

describe('lineStringToCells', () => {
  it('should return empty for empty waypoints', () => {
    expect(lineStringToCells([] as LonLat[], 5)).toEqual([]);
  });

  it('should return single cell for single waypoint', () => {
    const result = lineStringToCells([[10, 50] as LonLat], 5);
    expect(result).toHaveLength(1);
  });

  it('should deduplicate cells at segment junctions', () => {
    const waypoints = [[0, 50], [10, 50], [10, 45]] as LonLat[];
    const result = lineStringToCells(waypoints, 3);
    const unique = new Set(result);
    expect(result.length).toBe(unique.size);
  });
});

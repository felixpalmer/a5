import {describe, expect, test} from 'vitest';
import {getNumCells, getNumChildren, cellArea, cellEdgeLengthAvg} from 'a5/core/cell-info';
import {cellToBoundary, getResolution} from 'a5';
import {hexToU64} from 'a5/core/hex';
import {AUTHALIC_RADIUS_EARTH} from 'a5/core/constants';
import cellInfoFixtures from './fixtures/cell-info.json';
import serializationFixtures from './fixtures/serialization.json';

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

describe('cellEdgeLengthAvg', () => {
  test('returns correct edge length for all resolutions', () => {
    cellInfoFixtures.cellEdgeLengthAvg.forEach(fixture => {
      expect(cellEdgeLengthAvg(fixture.resolution)).toBe(fixture.lengthM);
    });
  });

  test('every boundary edge of the test cells is within ±10% of the average', () => {
    const DEG = Math.PI / 180;
    const geodesic = (a: number[], b: number[]) => {
      const [lat1, lat2] = [a[1] * DEG, b[1] * DEG];
      const h =
        Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(((b[0] - a[0]) * DEG) / 2) ** 2;
      return 2 * AUTHALIC_RADIUS_EARTH * Math.asin(Math.sqrt(h));
    };

    // Sample each edge with multiple segments to measure its true curved length
    const SEGMENTS = 10;
    for (const hex of serializationFixtures.testIds) {
      const cell = hexToU64(hex);
      const resolution = getResolution(cell);
      const avg = cellEdgeLengthAvg(resolution);
      const boundary = cellToBoundary(cell, {closedRing: true, segments: SEGMENTS});
      const numEdges = (boundary.length - 1) / SEGMENTS;
      for (let e = 0; e < numEdges; e++) {
        let length = 0;
        for (let i = 0; i < SEGMENTS; i++) {
          const idx = e * SEGMENTS + i;
          length += geodesic(boundary[idx], boundary[idx + 1]);
        }
        const ratio = length / avg;
        expect(ratio, `cell ${hex} edge ${e}`).toBeGreaterThan(0.9);
        expect(ratio, `cell ${hex} edge ${e}`).toBeLessThan(1.1);
      }
    }
  });
});

import {describe, it, expect} from 'vitest';
import {area, count} from 'a5/coverings/measures';
import {compact, uncompact} from 'a5/coverings/compact';
import {contains, difference, intersect, overlaps, union} from 'a5/coverings/set-operations';
import {coveringResolution} from 'a5/coverings/resolution';
import {isCompactionMarker} from 'a5/core/compaction-marker';
import {cellToBoundary} from 'a5/core/cell';
import {isValidCell} from 'a5/core/serialization';
import {hexToU64} from 'a5/core/hex';
import fixtures from './fixtures/covering.json';

const toCells = (hex: string[]) => hex.map(hexToU64);

describe('set operations', () => {
  for (const f of fixtures.setOperations) {
    it(`should match fixtures for ${f.name}`, () => {
      const a = toCells(f.a);
      const b = toCells(f.b);
      expect(Array.from(union(a, b))).toEqual(toCells(f.union));
      expect(Array.from(intersect(a, b))).toEqual(toCells(f.intersect));
      expect(Array.from(difference(a, b))).toEqual(toCells(f.difference));
      expect(overlaps(a, b)).toBe(f.overlaps);
      expect(overlaps(b, a)).toBe(f.overlaps);
      expect(coveringResolution(union(a, b))).toBe(f.resolution);
    });
  }

  for (const f of fixtures.mismatchedResolutions) {
    it(`should refuse sets at different resolutions: ${f.name}`, () => {
      const a = toCells(f.a);
      const b = toCells(f.b);
      expect(() => union(a, b)).toThrow();
      expect(() => intersect(a, b)).toThrow();
      expect(() => difference(a, b)).toThrow();
      expect(() => overlaps(a, b)).toThrow();
    });
  }

  it('should give the same results for input out of curve order', () => {
    // Sorted input is merged as given; anything else is detected and sorted first
    for (const f of fixtures.setOperations) {
      const a = toCells(f.a).reverse();
      const b = toCells(f.b).reverse();
      expect(Array.from(union(a, b))).toEqual(toCells(f.union));
      expect(Array.from(intersect(a, b))).toEqual(toCells(f.intersect));
      expect(Array.from(difference(a, b))).toEqual(toCells(f.difference));
    }
  });

  it('should accept BigUint64Array input', () => {
    const f = fixtures.setOperations[0];
    const a = BigUint64Array.from(toCells(f.a));
    const b = BigUint64Array.from(toCells(f.b));
    expect(Array.from(union(a, b))).toEqual(toCells(f.union));
  });
});

describe('measures', () => {
  for (const f of fixtures.measures) {
    it(`should match fixtures for ${f.name}`, () => {
      const cells = toCells(f.cells);
      expect(coveringResolution(cells)).toBe(f.resolution);
      expect(count(cells)).toBe(BigInt(f.count));
      expect(Math.abs(area(cells) - f.area)).toBeLessThanOrEqual(1e-10 * f.area);
    });
  }
});

describe('measures of overlapping input', () => {
  it('should count every cell given, including duplicates', () => {
    for (const f of fixtures.measures) {
      const cells = toCells(f.cells);
      const doubled = [...cells, ...cells];
      expect(count(doubled)).toBe(2n * BigInt(f.count));
      expect(Math.abs(area(doubled) - 2 * f.area)).toBeLessThanOrEqual(1e-10 * f.area);
      // union merges them
      expect(count(union(cells, cells))).toBe(BigInt(f.count));
    }
  });
});

describe('contains', () => {
  for (const f of fixtures.contains) {
    it(`should match fixtures for ${f.name}`, () => {
      const cells = toCells(f.cells);
      for (const probe of f.probes) {
        expect(contains(cells, hexToU64(probe.cell))).toBe(probe.expected);
      }
    });
  }
});

describe('contains at another resolution', () => {
  for (const f of fixtures.mismatchedProbes) {
    it(`should refuse cells at another resolution: ${f.name}`, () => {
      const cells = toCells(f.cells);
      for (const probe of f.probes) expect(() => contains(cells, hexToU64(probe))).toThrow();
    });
  }
});

describe('isCompactionMarker', () => {
  it('should recognize compaction markers and nothing else', () => {
    for (const f of fixtures.isCompactionMarker) {
      expect(isCompactionMarker(hexToU64(f.value))).toBe(f.expected);
    }
  });

  it('should record the resolution of each compaction marker', () => {
    for (const f of fixtures.isCompactionMarker) {
      if (!f.expected) continue;
      const value = hexToU64(f.value);
      expect(coveringResolution([value])).toBe(f.resolution);
    }
  });

  it('should have an empty boundary', () => {
    for (const f of fixtures.isCompactionMarker) {
      if (f.expected) expect(cellToBoundary(hexToU64(f.value))).toEqual([]);
    }
  });
});

describe('isValidCell', () => {
  it('should recognize A5 cells and nothing else', () => {
    for (const f of fixtures.isValidCell) {
      expect(isValidCell(hexToU64(f.value)), f.value).toBe(f.expected);
    }
  });

  it('should refuse values outside 64 bits', () => {
    expect(isValidCell(-1n)).toBe(false);
    expect(isValidCell(-(1n << 3n))).toBe(false);
    expect(isValidCell(1n << 64n)).toBe(false);
    expect(isValidCell((1n << 64n) | 1n)).toBe(false);
  });
});

describe('invalid cells', () => {
  const operations: Record<string, (cells: bigint[]) => unknown> = {
    compact: cells => compact(cells),
    uncompact: cells => uncompact(cells),
    count: cells => count(cells),
    area: cells => area(cells),
    union: cells => union(cells, cells),
    contains: cells => contains(cells, cells[0])
  };

  for (const [name, operation] of Object.entries(operations)) {
    it(`${name} should refuse values that are not cells`, () => {
      for (const value of fixtures.invalidCells) expect(() => operation([hexToU64(value)])).toThrow();
    });

    it(`${name} should accept the valid cells at the edges of the encoding`, () => {
      for (const value of fixtures.validEdgeCells) expect(() => operation([hexToU64(value)])).not.toThrow();
    });
  }
});

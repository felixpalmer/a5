import { describe, it, expect } from 'vitest';
import { compact, uncompact } from 'a5/core/compact';
import { hexToU64, u64ToHex } from 'a5/core/hex';
import { serialize, deserialize, cellToChildren, cellToParent } from 'a5/core/serialization';
import { origins } from 'a5/core/origin';
import compactFixtures from './fixtures/compact.json';

describe('uncompact', () => {
  it('should handle fixtures correctly', () => {
    for (const testCase of compactFixtures.uncompact) {
      const input = testCase.input.map(hexToU64);
      const result = uncompact(input, testCase.targetResolution);

      expect(result.length).toBe(testCase.expectedCount);

      // All results should be at target resolution
      for (const cell of result) {
        const cellData = deserialize(cell);
        expect(cellData.resolution).toBe(testCase.targetResolution);
      }
    }
  });

  it('should expand a parent cell to its children', () => {
    const parent = serialize({ origin: origins[0], segment: 0, S: 0n, resolution: 2 });
    const children = uncompact([parent], 3);

    expect(children.length).toBe(4);

    // All children should be at resolution 3
    for (const child of children) {
      expect(deserialize(child).resolution).toBe(3);
    }

    // All children should have the same parent
    for (const child of children) {
      expect(cellToParent(child)).toBe(parent);
    }
  });

  it('should leave cells at target resolution unchanged', () => {
    const cells = [
      serialize({ origin: origins[0], segment: 0, S: 5n, resolution: 4 }),
      serialize({ origin: origins[1], segment: 2, S: 10n, resolution: 4 })
    ];

    const result = uncompact(cells, 4);

    expect(result).toEqual(cells);
  });

  it('should handle mixed resolution input', () => {
    const res2Cell = serialize({ origin: origins[0], segment: 0, S: 0n, resolution: 2 });
    const res3Cell = serialize({ origin: origins[1], segment: 1, S: 2n, resolution: 3 });

    const result = uncompact([res2Cell, res3Cell], 4);

    // res2->res4 expands to 16 cells, res3->res4 expands to 4 cells
    expect(result.length).toBe(20);

    // All should be at resolution 4
    for (const cell of result) {
      expect(deserialize(cell).resolution).toBe(4);
    }
  });

  it('should throw error when trying to uncompact to lower resolution', () => {
    const cell = serialize({ origin: origins[0], segment: 0, S: 5n, resolution: 5 });

    expect(() => uncompact([cell], 3)).toThrow();
  });

  it('should handle empty array', () => {
    const result = uncompact([], 5);
    expect(result).toEqual([]);
  });

  it('should correctly expand resolution 0 to resolution 1', () => {
    const res0Cell = serialize({ origin: origins[0], segment: 0, S: 0n, resolution: 0 });
    const result = uncompact([res0Cell], 1);

    // Should expand to 5 segments
    expect(result.length).toBe(5);

    // All should be at resolution 1 with same origin
    for (const cell of result) {
      const cellData = deserialize(cell);
      expect(cellData.resolution).toBe(1);
      expect(cellData.origin.id).toBe(0);
    }
  });

  it('should expand multiple levels correctly', () => {
    const res2Cell = serialize({ origin: origins[0], segment: 0, S: 0n, resolution: 2 });
    const result = uncompact([res2Cell], 5);

    // res2->res5 is 3 levels, so 4^3 = 64 cells
    expect(result.length).toBe(64);

    // All should be at resolution 5
    for (const cell of result) {
      expect(deserialize(cell).resolution).toBe(5);
    }

    // All should have the same parent at resolution 2
    const uniqueParents = new Set(result.map(c => cellToParent(c, 2)));
    expect(uniqueParents.size).toBe(1);
    expect(uniqueParents.has(res2Cell)).toBe(true);
  });
});

describe('compact', () => {
  it('should handle fixtures correctly', () => {
    for (const testCase of compactFixtures.compact) {
      const input = testCase.input.map(hexToU64);
      const expected = testCase.expectedOutput.map(hexToU64).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
      const result = compact(input);

      expect(result).toEqual(expected);
    }
  });

  it('should compact four siblings into parent', () => {
    const parent = serialize({ origin: origins[0], segment: 0, S: 0n, resolution: 2 });
    const children = cellToChildren(parent, 3);

    const result = compact(children);

    expect(result.length).toBe(1);
    expect(result[0]).toBe(parent);
  });

  it('should not compact incomplete sibling groups', () => {
    const parent = serialize({ origin: origins[0], segment: 0, S: 0n, resolution: 2 });
    const children = cellToChildren(parent, 3);
    const incompleteChildren = children.slice(0, 3); // Only 3 of 4

    const result = compact(incompleteChildren);

    expect(result.length).toBe(3);
    expect(result).toEqual(incompleteChildren.sort((a, b) => a < b ? -1 : a > b ? 1 : 0));
  });

  it('should compact five segments into resolution 0 cell', () => {
    const res0Cell = serialize({ origin: origins[0], segment: 0, S: 0n, resolution: 0 });
    const segments = cellToChildren(res0Cell, 1);

    expect(segments.length).toBe(5);

    const result = compact(segments);

    expect(result.length).toBe(1);
    expect(result[0]).toBe(res0Cell);
  });

  it('should perform nested compaction', () => {
    const res2Cell = serialize({ origin: origins[0], segment: 0, S: 0n, resolution: 2 });
    const res4Cells = cellToChildren(res2Cell, 4);

    expect(res4Cells.length).toBe(16);

    const result = compact(res4Cells);

    expect(result.length).toBe(1);
    expect(result[0]).toBe(res2Cell);
  });

  it('should handle partial compaction', () => {
    const parent1 = serialize({ origin: origins[0], segment: 0, S: 0n, resolution: 2 });
    const parent2 = serialize({ origin: origins[0], segment: 0, S: 1n, resolution: 2 });

    const children1 = cellToChildren(parent1, 3); // All 4 children
    const children2 = cellToChildren(parent2, 3).slice(0, 2); // Only 2 of 4 children

    const input = [...children1, ...children2];
    const result = compact(input);

    // Should compact children1 to parent1, but leave children2 as is
    expect(result.length).toBe(3); // parent1 + 2 children from children2
    expect(result).toContain(parent1);
  });

  it('should remove duplicates', () => {
    const cell = serialize({ origin: origins[0], segment: 0, S: 5n, resolution: 5 });
    const result = compact([cell, cell, cell]);

    expect(result.length).toBe(1);
    expect(result[0]).toBe(cell);
  });

  it('should handle empty array', () => {
    const result = compact([]);
    expect(result).toEqual([]);
  });

  it('should handle single cell', () => {
    const cell = serialize({ origin: origins[0], segment: 0, S: 5n, resolution: 5 });
    const result = compact([cell]);

    expect(result).toEqual([cell]);
  });

  it('should not compact cells at different resolutions', () => {
    const res3Cell = serialize({ origin: origins[0], segment: 0, S: 5n, resolution: 3 });
    const res4Cell = serialize({ origin: origins[1], segment: 2, S: 10n, resolution: 4 });

    const result = compact([res3Cell, res4Cell]);

    expect(result.length).toBe(2);
    expect(result).toContain(res3Cell);
    expect(result).toContain(res4Cell);
  });

  it('should handle resolution 0 cells correctly', () => {
    const res0Cell = serialize({ origin: origins[0], segment: 0, S: 0n, resolution: 0 });
    const result = compact([res0Cell]);

    expect(result).toEqual([res0Cell]);
  });

  it('should compact deeply nested cells', () => {
    // Create 64 cells at resolution 5 that all belong to same parent at res 2
    const res2Cell = serialize({ origin: origins[1], segment: 2, S: 3n, resolution: 2 });
    const res5Cells = cellToChildren(res2Cell, 5);

    expect(res5Cells.length).toBe(64);

    const result = compact(res5Cells);

    expect(result.length).toBe(1);
    expect(result[0]).toBe(res2Cell);
  });
});

describe('compact/uncompact round-trip', () => {
  it('should maintain equivalence through round-trip', () => {
    const parent = serialize({ origin: origins[0], segment: 0, S: 0n, resolution: 2 });
    const children = cellToChildren(parent, 4);

    // Compact then uncompact
    const compacted = compact(children);
    const uncompacted = uncompact(compacted, 4);

    // Should get back the same set of cells
    expect(uncompacted.sort((a, b) => a < b ? -1 : a > b ? 1 : 0))
      .toEqual(children.sort((a, b) => a < b ? -1 : a > b ? 1 : 0));
  });

  it('should handle mixed resolutions in round-trip', () => {
    const cells = [
      serialize({ origin: origins[0], segment: 0, S: 0n, resolution: 2 }),
      serialize({ origin: origins[1], segment: 1, S: 5n, resolution: 3 }),
      serialize({ origin: origins[2], segment: 2, S: 10n, resolution: 4 })
    ];

    // Uncompact all to resolution 5
    const uncompacted = uncompact(cells, 5);

    // Compact back
    const compacted = compact(uncompacted);

    // Should be able to uncompact to same resolution again
    const uncompactedAgain = uncompact(compacted, 5);

    expect(uncompactedAgain.sort((a, b) => a < b ? -1 : a > b ? 1 : 0))
      .toEqual(uncompacted.sort((a, b) => a < b ? -1 : a > b ? 1 : 0));
  });

  it('should maintain cell coverage through operations', () => {
    // Start with all children of a parent
    const parent = serialize({ origin: origins[3], segment: 1, S: 0n, resolution: 3 });
    const originalChildren = cellToChildren(parent, 5);

    // Compact some but not all
    const partialCompact = compact(originalChildren.slice(0, 48)); // 3/4 of children

    // Add remaining children
    const combined = [...partialCompact, ...originalChildren.slice(48)];

    // Compact again - should now compact fully
    const fullyCompacted = compact(combined);

    expect(fullyCompacted.length).toBe(1);
    expect(fullyCompacted[0]).toBe(parent);
  });
});

describe('compact edge cases', () => {
  it('should handle world cell and all resolution 0 cells', () => {
    const res0Cells = [];
    for (let i = 0; i < 12; i++) {
      res0Cells.push(serialize({ origin: origins[i], segment: 0, S: 0n, resolution: 0 }));
    }

    const result = compact(res0Cells);

    // Should compact to world cell (resolution -1, index 0n)
    expect(result.length).toBe(1);
    expect(result[0]).toBe(0n);
  });

  it('should not compact incomplete set of resolution 0 cells', () => {
    const res0Cells = [];
    for (let i = 0; i < 11; i++) { // Only 11 of 12
      res0Cells.push(serialize({ origin: origins[i], segment: 0, S: 0n, resolution: 0 }));
    }

    const result = compact(res0Cells);

    expect(result.length).toBe(11);
  });

  it('should compact cells from different origins when they form complete groups', () => {
    const parent1 = serialize({ origin: origins[0], segment: 1, S: 5n, resolution: 3 });
    const parent2 = serialize({ origin: origins[1], segment: 2, S: 10n, resolution: 3 });

    const children1 = cellToChildren(parent1, 4);
    const children2 = cellToChildren(parent2, 4);

    const combined = [...children1, ...children2];
    const result = compact(combined);

    expect(result.length).toBe(2);
    expect(result).toContain(parent1);
    expect(result).toContain(parent2);
  });
});

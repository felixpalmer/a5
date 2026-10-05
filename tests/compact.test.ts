import {describe, it, expect} from 'vitest';
import {compact, uncompact} from 'a5/collections/compact';
import {getCompactionResolution} from 'a5/collections/resolution';
import {hexToU64} from 'a5/core/hex';
import {getResolution} from 'a5/core/serialization';
import compactFixtures from './fixtures/compact.json';

describe('uncompact', () => {
  it('should handle all fixture test cases', () => {
    for (const testCase of compactFixtures.uncompact) {
      const input = testCase.input.map(hexToU64);
      const result = uncompact(input);

      expect(result.length).toBe(testCase.expectedCount);
      expect(Array.from(result)).toEqual(testCase.expectedCells.map(hexToU64));
      expect(getCompactionResolution(input)).toBe(testCase.expectedResolution);

      // All results should be at the collection's resolution
      for (const cell of result) {
        expect(getResolution(cell)).toBe(testCase.expectedResolution);
      }
    }
  });
});

describe('compact', () => {
  it('should handle all fixture test cases', () => {
    for (const testCase of compactFixtures.compact) {
      const input = testCase.input.map(hexToU64);
      const expected = testCase.expectedOutput.map(hexToU64);
      const result = compact(input);

      // Output is canonical: cells in curve order, then the compaction marker
      expect(Array.from(result)).toEqual(expected);
    }
  });
});

describe('compact/uncompact round-trip', () => {
  it('should handle all round-trip fixture test cases', () => {
    for (const testCase of compactFixtures.roundTrip) {
      const initialCells = testCase.initialCells.map(hexToU64);
      const afterCompact = testCase.afterCompact.map(hexToU64);

      // Verify compact result matches fixture
      expect(Array.from(compact(initialCells))).toEqual(afterCompact);

      // Verify uncompact restores coverage, at the resolution the compaction marker records
      const uncompactResult = uncompact(afterCompact);
      expect(uncompactResult.length).toBe(testCase.expectedFinalCount);
      for (const cell of uncompactResult) {
        expect(getResolution(cell)).toBe(testCase.resolution);
      }
    }
  });
});

import { describe, it, expect } from 'vitest';
import { compact, uncompact } from 'a5/core/compact';
import { hexToU64 } from 'a5/core/hex';
import { deserialize } from 'a5/core/serialization';
import compactFixtures from './fixtures/compact.json';

describe('uncompact', () => {
  it('should handle all fixture test cases', () => {
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

});

describe('compact', () => {
  it('should handle all fixture test cases', () => {
    for (const testCase of compactFixtures.compact) {
      const input = testCase.input.map(hexToU64);
      const expected = testCase.expectedOutput.map(hexToU64).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
      const result = compact(input);

      expect(result).toEqual(expected);
    }
  });
});


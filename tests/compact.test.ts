import { describe, it, expect } from 'vitest';
import { compact, uncompact } from 'a5/core/compact';
import { compactForwardScan } from 'a5/core/compact.optimized';
import { hexToU64 } from 'a5/core/hex';
import { deserialize } from 'a5/core/serialization';
import compactFixtures from './fixtures/compact.json';

describe('uncompact', () => {
  it('should handle all fixture test cases', () => {
    for (const testCase of compactFixtures.uncompact) {
      // Skip error test cases - handle separately
      if (testCase.expectedError) continue;

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

  it('should throw error when trying to uncompact to lower resolution', () => {
    const errorCase = compactFixtures.uncompact.find(tc => tc.expectedError);
    if (errorCase) {
      const input = errorCase.input.map(hexToU64);
      expect(() => uncompact(input, errorCase.targetResolution)).toThrow();
    }
  });
});

describe('compact', () => {
  it('should handle all fixture test cases', () => {
    for (const testCase of compactFixtures.compact) {
      const input = testCase.input.map(hexToU64);
      const expected = testCase.expectedOutput.map(hexToU64).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
      const result = compact(input);

      expect(Array.from(result)).toEqual(expected);
    }
  });
});

describe('compactForwardScan', () => {
  it('should produce same results as compact on all fixture test cases', () => {
    for (const testCase of compactFixtures.compact) {
      const input = testCase.input.map(hexToU64);
      const expected = testCase.expectedOutput.map(hexToU64).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);

      const resultOriginal = compact(input);
      const resultForwardScan = compactForwardScan(input);

      // Both should produce same output
      expect(Array.from(resultForwardScan)).toEqual(Array.from(resultOriginal));
      expect(Array.from(resultForwardScan)).toEqual(expected);
    }
  });

  it('should handle round-trip test cases', () => {
    for (const testCase of compactFixtures.roundTrip) {
      const initialCells = testCase.initialCells.map(hexToU64);

      const resultOriginal = compact(initialCells);
      const resultForwardScan = compactForwardScan(initialCells);

      // Both should produce same output
      expect(Array.from(resultForwardScan).sort((a, b) => a < b ? -1 : a > b ? 1 : 0))
        .toEqual(Array.from(resultOriginal).sort((a, b) => a < b ? -1 : a > b ? 1 : 0));
    }
  });
});

describe('compact/uncompact round-trip', () => {
  it('should handle all round-trip fixture test cases', () => {
    for (const testCase of compactFixtures.roundTrip) {
      const initialCells = testCase.initialCells.map(hexToU64);
      const afterCompact = testCase.afterCompact.map(hexToU64);

      // Verify compact result matches fixture
      const compactResult = compact(initialCells);
      expect(Array.from(compactResult).sort((a, b) => a < b ? -1 : a > b ? 1 : 0))
        .toEqual(afterCompact.sort((a, b) => a < b ? -1 : a > b ? 1 : 0));

      // Verify uncompact restores coverage
      const uncompactResult = uncompact(afterCompact, testCase.targetResolution);

      if (testCase.expectedCount) {
        expect(uncompactResult.length).toBe(testCase.expectedCount);
      }

      if (testCase.expectedFinalCount) {
        expect(uncompactResult.length).toBe(testCase.expectedFinalCount);
      }

      // All results should be at target resolution
      for (const cell of uncompactResult) {
        const cellData = deserialize(cell);
        expect(cellData.resolution).toBe(testCase.targetResolution);
      }
    }
  });
});


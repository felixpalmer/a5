import { describe, it, expect } from 'vitest';
import type { Quaternary, Flip } from 'a5/lattice';
import {
  shiftDigits,
  PATTERN,
  PATTERN_FLIPPED,
  PATTERN_REVERSED,
  PATTERN_FLIPPED_REVERSED,
} from 'a5/lattice';
import fixtures from '../fixtures/lattice/shift-digits.json';

const PATTERNS: Record<string, number[]> = {
  PATTERN,
  PATTERN_FLIPPED,
  PATTERN_REVERSED,
  PATTERN_FLIPPED_REVERSED,
};

type ShiftDigitsFixture = {
  digitsBefore: number[];
  i: number;
  flips: [Flip, Flip];
  invertJ: boolean;
  patternName: string;
  digitsAfter: number[];
};

describe('shiftDigits', () => {
  it('produces correct output for all test cases', () => {
    for (const f of fixtures.shiftDigits as ShiftDigitsFixture[]) {
      const digits = [...f.digitsBefore] as Quaternary[];
      const pattern = PATTERNS[f.patternName];
      shiftDigits(digits, f.i, f.flips, f.invertJ, pattern);
      expect(
        [...digits],
        `i=${f.i} flips=[${f.flips}] invertJ=${f.invertJ} pattern=${f.patternName} digits=${f.digitsBefore}`
      ).toEqual(f.digitsAfter);
    }
  });
});

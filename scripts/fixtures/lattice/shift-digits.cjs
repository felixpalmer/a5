const fs = require('fs');
const path = require('path');
const { shiftDigits } = require('../../a5-test.cjs');

const outputDir = path.join(__dirname, '../../../tests/fixtures/lattice');
const outputPath = path.join(outputDir, 'shift-digits.json');

console.log('Generating lattice/shift-digits fixtures...');

// YES = -1, NO = 1
const YES = -1;
const NO = 1;

const flipCombos = [
  [NO, NO],
  [NO, YES],
  [YES, NO],
  [YES, YES],
];

const patterns = {
  PATTERN: [0, 1, 3, 4, 5, 6, 7, 2],
  PATTERN_FLIPPED: [0, 1, 2, 7, 3, 4, 5, 6],
};

// Reverse pattern helper (same as in shift-digits.ts)
function reversePattern(pattern) {
  return Array.from({length: pattern.length}, (_, i) => pattern.indexOf(i));
}
patterns.PATTERN_REVERSED = reversePattern(patterns.PATTERN);
patterns.PATTERN_FLIPPED_REVERSED = reversePattern(patterns.PATTERN_FLIPPED);

const shiftDigitsFixtures = [];

// Test with crafted digit arrays at various positions
for (const [patternName, pattern] of Object.entries(patterns)) {
  for (const flips of flipCombos) {
    for (const invertJ of [false, true]) {
      // Test with 3-digit arrays, shifting at position i=1 and i=2
      for (let i = 1; i <= 2; i++) {
        for (let parentK = 0; parentK < 4; parentK++) {
          for (let childK = 0; childK < 4; childK++) {
            const digits = i === 1
              ? [childK, parentK, 0]
              : [0, childK, parentK];

            const digitsBefore = [...digits];
            shiftDigits(digits, i, flips, invertJ, pattern);

            shiftDigitsFixtures.push({
              digitsBefore,
              i,
              flips: [...flips],
              invertJ,
              patternName,
              digitsAfter: [...digits],
            });
          }
        }
      }
    }
  }
}

// Also test i=0 (should be a no-op)
for (const [patternName, pattern] of Object.entries(patterns)) {
  const digits = [2, 1, 3];
  const digitsBefore = [...digits];
  shiftDigits(digits, 0, [NO, NO], false, pattern);
  shiftDigitsFixtures.push({
    digitsBefore,
    i: 0,
    flips: [NO, NO],
    invertJ: false,
    patternName,
    digitsAfter: [...digits],
  });
}

console.log(`  shiftDigits: ${shiftDigitsFixtures.length} cases`);

const fixtures = {
  shiftDigits: shiftDigitsFixtures,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(fixtures, null, 2));
console.log(`  Wrote fixtures to ${outputPath}`);

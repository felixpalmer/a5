const fs = require('fs');
const path = require('path');
const { IJToQuaternary } = require('../../a5-test.cjs');
const { quaternaryToKJ, quaternaryToFlips } = require('../../a5-test.cjs');

const outputDir = path.join(__dirname, '../../../tests/fixtures/lattice');
const outputPath = path.join(outputDir, 'quaternary.json');

console.log('Generating lattice/quaternary fixtures...');

// YES = -1, NO = 1
const YES = -1;
const NO = 1;

const flipCombos = [
  [NO, NO],
  [NO, YES],
  [YES, NO],
  [YES, YES],
];

// --- IJToQuaternary ---
// Test with IJ values that cover all 4 quaternary outputs for each flip combo
// Use known anchor offsets from sToAnchor at various resolutions
const ijToQuaternaryFixtures = [];

// Systematic: probe fractional IJ values that land in each quadrant
const testIJs = [
  [0.3, 0.3],   // near origin
  [0.7, 0.1],   // along i axis
  [0.1, 0.7],   // along j axis
  [1.5, 0.3],   // past first boundary in i
  [0.3, 1.5],   // past first boundary in j
  [1.2, 1.2],   // large both
  [2.0, 0.5],   // far along i
  [0.5, 2.0],   // far along j
  [-0.3, 0.3],  // negative i
  [0.3, -0.3],  // negative j
  [-1.5, 0.3],  // large negative i
  [0.3, -1.5],  // large negative j
  [-1.2, -1.2], // both negative
  [0.0, 0.0],   // origin
  [1.0, 0.0],   // boundary
  [0.0, 1.0],   // boundary
];

for (const flips of flipCombos) {
  for (const ij of testIJs) {
    const digit = IJToQuaternary(ij, flips);
    ijToQuaternaryFixtures.push({
      ij: [...ij],
      flips: [...flips],
      digit,
    });
  }
}
console.log(`  IJToQuaternary: ${ijToQuaternaryFixtures.length} cases`);

// --- quaternaryToKJ ---
const quaternaryToKJFixtures = [];
for (const flips of flipCombos) {
  for (let q = 0; q < 4; q++) {
    const kj = quaternaryToKJ(q, flips);
    quaternaryToKJFixtures.push({
      q,
      flips: [...flips],
      kj: [kj[0] || 0, kj[1] || 0],  // normalize -0 to 0 for JSON round-trip
    });
  }
}
console.log(`  quaternaryToKJ: ${quaternaryToKJFixtures.length} cases`);

// --- quaternaryToFlips ---
const quaternaryToFlipsFixtures = [];
for (let q = 0; q < 4; q++) {
  const flips = quaternaryToFlips(q);
  quaternaryToFlipsFixtures.push({
    q,
    flips: [flips[0], flips[1]],
  });
}
console.log(`  quaternaryToFlips: ${quaternaryToFlipsFixtures.length} cases`);

const fixtures = {
  IJToQuaternary: ijToQuaternaryFixtures,
  quaternaryToKJ: quaternaryToKJFixtures,
  quaternaryToFlips: quaternaryToFlipsFixtures,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(fixtures, null, 2));
console.log(`  Wrote fixtures to ${outputPath}`);
